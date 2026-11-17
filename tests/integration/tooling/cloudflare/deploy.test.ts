import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";

const script = resolve("tooling/cloudflare/deploy.ts");
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A built Worker as `cf build` leaves it, in a throwaway app folder. */
function built(name: string, mode: string, d1 = "d1-id", hyperdrive = "hd-id") {
  const app = mkdtempSync(join(tmpdir(), "shopper-deploy-"));
  folders.push(app);
  const output = join(app, ".cloudflare/output/v0");
  mkdirSync(join(output, "workers/default"), { recursive: true });
  writeFileSync(join(output, "config.json"), JSON.stringify({ buildContext: { mode } }));
  writeFileSync(
    join(output, "workers/default/worker.config.json"),
    JSON.stringify({
      name,
      domains: ["shopper-api.temtem.dev"],
      env: {
        CACHE_DB: { type: "d1", id: d1 },
        HYPERDRIVE: { type: "hyperdrive", id: hyperdrive },
        SHOPPER_AUTH_SECRET: { type: "secret" },
      },
    }),
  );
  return app;
}

function deploy(app: string, ...args: string[]) {
  return deployWith({}, app, ...args);
}

function deployWith(env: Record<string, string>, app: string, ...args: string[]) {
  // Resolved here: the throwaway app folder has no node_modules to find tsx in.
  const result = spawnSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), script, ...args],
    {
      cwd: app,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://direct/db",
        SHOPPER_AUTH_SECRET: "x",
        ...env,
      },
    },
  );
  return { status: result.status, out: result.stdout, err: result.stderr };
}

test("production uploads a version that serves nothing, and migrates nothing", () => {
  const result = deploy(
    built("shopper-edge-production", "prod"),
    "edge",
    "--stage",
    "production",
    "--plan",
  );
  expect(result.status).toBe(0);
  expect(result.out).toContain("cf workers versions create --prebuilt --mode prod");
  expect(result.out).not.toContain("database/cli.ts migrate");
  expect(result.out).not.toMatch(/^cf deploy/m);
});

test("--promote migrates, deploys the build to all traffic and smoke tests it", () => {
  const result = deploy(
    built("shopper-edge-production", "prod"),
    "edge",
    "--stage",
    "production",
    "--promote",
    "--plan",
  );
  expect(result.status).toBe(0);
  const lines = result.out.trim().split("\n");
  // Not `vp run db:migrate`: any `vp run` clears every app's .cloudflare/output, the build about to ship.
  expect(lines[0]).toBe("vp exec tsx tooling/database/cli.ts migrate");
  expect(lines[1]).toContain("cf d1 migrations apply d1-id");
  expect(lines.at(-2)).toMatch(/^cf deploy --prebuilt --mode prod --tag v\S+ --no-provision$/);
  expect(lines.at(-1)).toBe("smoke edge https://shopper-api.temtem.dev");
});

test("staging still deploys straight to traffic", () => {
  const result = deploy(
    built("shopper-edge-staging", "staging"),
    "edge",
    "--stage",
    "staging",
    "--plan",
  );
  expect(result.status).toBe(0);
  expect(result.out).toMatch(/^cf deploy --prebuilt --mode staging --tag v\S+ --no-provision$/m);
});

test("a build for another stage, or a production build without its resource ids, is refused", () => {
  const staging = built("shopper-edge-staging", "staging");
  expect(deploy(staging, "edge", "--stage", "production", "--plan").err).toMatch(
    /Refusing to deploy "shopper-edge-staging" as production/,
  );
  const unprovisioned = built("shopper-edge-production", "prod", "");
  expect(deploy(unprovisioned, "edge", "--stage", "production", "--plan").err).toMatch(
    /CACHE_DB has no id/,
  );
  expect(deploy(staging, "edge", "--plan").err).toMatch(/--stage staging\|production/);
  expect(deploy(staging, "edge", "--stage", "staging", "--promote", "--plan").err).toMatch(
    /--promote is for production/,
  );
});

test("the online store deploys to staging and smoke tests its own domain", () => {
  const result = deploy(
    built("shopper-shop-staging", "staging"),
    "shop",
    "--stage",
    "staging",
    "--plan",
  );
  expect(result.status).toBe(0);
  expect(result.out).toMatch(/^cf deploy --prebuilt --mode staging/m);
  expect(result.out).not.toContain("database/cli.ts migrate");
  expect(result.out).toContain("smoke shop https://shopper-api.temtem.dev");
});

/** A `cf` on PATH that logs each call and answers `workers get` as if the Worker does or does not exist. */
function fakeCf(exists: boolean | "unreachable") {
  const answer: Record<string, string> = {
    true: "exit 0",
    false: 'echo "[10007] This Worker does not exist on your account." >&2; exit 1',
    unreachable: 'echo "fetch failed" >&2; exit 1',
  };
  const bin = mkdtempSync(join(tmpdir(), "shopper-cf-"));
  folders.push(bin);
  const log = join(bin, "calls.log");
  writeFileSync(
    join(bin, "cf"),
    `#!/bin/sh\necho "cf $*" >> "${log}"\n[ "$1 $2" = "workers get" ] && ${answer[String(exists)]}\nexit 0\n`,
    { mode: 0o755 },
  );
  return { env: { PATH: `${bin}:${process.env.PATH}` }, calls: () => readFileSync(log, "utf8") };
}

// Cloudflare refuses a version upload for a Worker that was never deployed; promote's `cf deploy` creates it.
test("a production Worker that does not exist yet skips the upload and is created on promote", () => {
  const cf = fakeCf(false);
  const result = deployWith(
    cf.env,
    built("shopper-shop-production", "prod"),
    "shop",
    "--stage",
    "production",
  );
  expect(result.status).toBe(0);
  expect(cf.calls()).toContain("cf workers get shopper-shop-production");
  expect(cf.calls()).not.toContain("versions create");
  expect(result.out).toContain("shopper-shop-production does not exist yet");
});

test("a production Worker that exists gets its version uploaded", () => {
  const cf = fakeCf(true);
  const result = deployWith(
    cf.env,
    built("shopper-shop-production", "prod"),
    "shop",
    "--stage",
    "production",
  );
  expect(result.status).toBe(0);
  expect(cf.calls()).toMatch(/^cf workers versions create --prebuilt --mode prod/m);
});

test("a failed existence check stops the release instead of skipping the upload", () => {
  const cf = fakeCf("unreachable");
  const result = deployWith(
    cf.env,
    built("shopper-shop-production", "prod"),
    "shop",
    "--stage",
    "production",
  );
  expect(result.status).not.toBe(0);
  expect(result.err).toContain("Could not check whether shopper-shop-production exists");
  expect(cf.calls()).not.toContain("versions create");
});
