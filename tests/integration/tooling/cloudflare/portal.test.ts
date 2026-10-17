/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vite-plus/test";

const portal = resolve("apps/portal");
const output = resolve(portal, ".cloudflare/output/v0");
const assets = resolve(output, "workers/default/assets");

beforeAll(() => {
  execFileSync("vp", ["build", "--mode", "staging"], {
    cwd: portal,
    stdio: "pipe",
    env: { ...process.env, CI: "1", CF_SEND_TELEMETRY: "false" },
  });
}, 300_000);

function worker() {
  return JSON.parse(readFileSync(resolve(output, "workers/default/worker.config.json"), "utf8"));
}

test("the build prerenders a static SPA shell", () => {
  const shell = readFileSync(resolve(assets, "index.html"), "utf8");
  expect(shell).toContain("<script");
  expect(shell).toContain("$tsr");
  expect(shell).not.toContain("Sign in");
  expect(existsSync(resolve(assets, "login/index.html"))).toBe(false);
});

test("only API and server functions reach the staging Worker", () => {
  const config = worker();
  expect(JSON.parse(readFileSync(resolve(output, "config.json"), "utf8")).buildContext.mode).toBe(
    "staging",
  );
  expect(config.name).toBe("shopper-portal-staging");
  expect(config.assets).toMatchObject({
    notFoundHandling: "single-page-application",
    runWorkerFirst: ["/api/*", "/_serverFn/*"],
  });
  expect(config.domains).toEqual(["shopper-staging.temtem.dev"]);
});

test("the portal binds the edge's Durable Objects and Workflows by Worker name", () => {
  const bound = Object.values(worker().env) as Array<{ type: string; worker?: string }>;
  const ofType = (type: string) => bound.filter((binding) => binding.type === type);
  expect(ofType("durable-object")).toHaveLength(2);
  expect(ofType("workflow")).toHaveLength(3);
  for (const binding of [...ofType("durable-object"), ...ofType("workflow")])
    expect(binding.worker).toBe("shopper-edge-staging");
  expect(ofType("queue")).toHaveLength(1);
  expect(ofType("hyperdrive")).toHaveLength(1);
  expect(ofType("d1")).toHaveLength(1);
  expect(ofType("r2")).toHaveLength(3);
  expect(ofType("browser")).toHaveLength(1);
});

test("configuration is text, credentials are secrets, and the prerender flag never ships", () => {
  const { env } = worker();
  expect(env.SHOPPER_ENVIRONMENT).toMatchObject({ type: "text", value: "staging" });
  expect(env.SHOPPER_AUTH_URL).toMatchObject({
    type: "text",
    value: "https://shopper-staging.temtem.dev",
  });
  expect(env.SHOPPER_S3_BUCKET).toMatchObject({ type: "text", value: "shopper-imports-staging" });
  expect(env.SHOPPER_S3_RECEIPTS_BUCKET).toMatchObject({
    type: "text",
    value: "shopper-receipts-staging",
  });
  expect(env.TSS_PRERENDERING).toBeUndefined();
  const files = readdirSync(output, { recursive: true }).map(String);
  expect(files.filter((file) => file.includes(".dev.vars"))).toEqual([]);
});
