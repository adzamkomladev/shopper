import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: app,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://direct/db", SHOPPER_AUTH_SECRET: "x" },
  });
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
  expect(result.out).not.toContain("db:migrate");
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
  expect(lines[0]).toContain("db:migrate");
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
