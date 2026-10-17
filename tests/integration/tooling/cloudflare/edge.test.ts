/// <reference types="node" />
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vite-plus/test";

const edge = resolve("apps/edge");
const output = resolve(edge, ".cloudflare/output/v0");
const env = { ...process.env, CI: "1", CF_SEND_TELEMETRY: "false" };

beforeAll(() => {
  execFileSync("vp", ["exec", "cf", "build", "--mode", "staging"], {
    cwd: edge,
    stdio: "pipe",
    env,
  });
}, 300_000);

function worker() {
  return JSON.parse(readFileSync(resolve(output, "workers/default/worker.config.json"), "utf8"));
}

test("the staging build is the shopper-edge-staging Worker with its domain and traces", () => {
  const top = JSON.parse(readFileSync(resolve(output, "config.json"), "utf8"));
  expect(top.buildContext.mode).toBe("staging");
  const config = worker();
  expect(config.name).toBe("shopper-edge-staging");
  expect(config.domains).toEqual(["shopper-api-staging.temtem.dev"]);
  expect(config.workersDev).toBe(true);
  expect(config.observability.traces.enabled).toBe(true);
});

test("Durable Objects, Workflows and every resource binding are the staging ones", () => {
  const { env: bound, exports } = worker();
  expect(exports.StoreSequencer).toMatchObject({ type: "durable-object", storage: "sqlite" });
  expect(exports.StoreHub).toMatchObject({ type: "durable-object", storage: "sqlite" });
  for (const [exportName, name] of [
    ["PriceChangeWorkflow", "shopper-price-change-staging"],
    ["AuthWorkflow", "shopper-auth-flow-staging"],
    ["MomoPaymentWorkflow", "shopper-momo-payment-staging"],
  ]) {
    expect(exports[exportName]).toMatchObject({ type: "workflow", name });
  }
  expect(bound.STORE_SEQUENCER).toMatchObject({
    type: "durable-object",
    exportName: "StoreSequencer",
  });
  expect(bound.STORE_HUB).toMatchObject({ type: "durable-object", exportName: "StoreHub" });
  expect(bound.CACHE_DB).toMatchObject({ type: "d1", id: "44230678-333c-446c-af51-22fe0c8eb20e" });
  expect(bound.HYPERDRIVE).toMatchObject({
    type: "hyperdrive",
    id: "dfa4e3a17ca546ed8213ed257912db3f",
  });
  expect(bound.BLOBS).toMatchObject({ type: "r2", name: "shopper-assets-staging" });
  expect(bound.IMPORTS).toMatchObject({ type: "r2", name: "shopper-imports-staging" });
  expect(bound.RECEIPTS).toMatchObject({ type: "r2", name: "shopper-receipts-staging" });
  expect(bound.NOTIFICATIONS).toMatchObject({
    type: "queue",
    name: "shopper-notifications-staging",
  });
  expect(bound.BROWSER).toMatchObject({ type: "browser" });
  expect(bound.BROWSER.dev?.remote).toBeUndefined();
});

test("bucket names and the R2 S3 location are text; credentials are secrets", () => {
  const { env: bound } = worker();
  expect(bound.SHOPPER_S3_BUCKET).toMatchObject({ type: "text", value: "shopper-imports-staging" });
  expect(bound.SHOPPER_S3_RECEIPTS_BUCKET).toMatchObject({
    type: "text",
    value: "shopper-receipts-staging",
  });
  expect(bound.SHOPPER_S3_REGION).toMatchObject({ type: "text", value: "auto" });
  expect(bound.SHOPPER_S3_ENDPOINT).toMatchObject({
    type: "text",
    value: "https://bd9ef997b398c9aeeee8ac3d3618efdc.r2.cloudflarestorage.com",
  });
  const secrets = Object.entries(bound)
    .filter(([, binding]) => (binding as { type: string }).type === "secret")
    .map(([name]) => name)
    .sort();
  expect(secrets).toEqual([
    "MAILEROO_API_KEY",
    "MAILEROO_FROM",
    "PAYSTACK_SECRET_KEY",
    "SHOPPER_AUTH_SECRET",
    "SHOPPER_AUTH_URL",
    "SHOPPER_LINK_SECRET",
    "SHOPPER_S3_ACCESS_KEY_ID",
    "SHOPPER_S3_SECRET_ACCESS_KEY",
  ]);
});

test("no secret file lands in the build output", () => {
  const files = readdirSync(output, { recursive: true }).map(String);
  expect(files.filter((file) => file.includes(".dev.vars"))).toEqual([]);
  expect(existsSync(resolve(output, "workers/default"))).toBe(true);
});

test("the deploy script refuses a build that is not a staging Worker", () => {
  execFileSync("vp", ["exec", "cf", "build", "--mode", "dev"], { cwd: edge, stdio: "pipe", env });
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "../../tooling/cloudflare/deploy.ts", "edge", "--dry-run"],
    {
      cwd: edge,
      encoding: "utf8",
      env: { ...env, DATABASE_URL: "postgres://unused" },
    },
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Refusing to deploy");
}, 300_000);
