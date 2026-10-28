/// <reference types="node" />
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vite-plus/test";

const portal = resolve("apps/portal");
const output = resolve(portal, ".cloudflare/output/v0");
const assets = resolve(output, "workers/default/assets");

// The test runner exports NODE_ENV=test; a release build must not inherit it.
const env = { ...process.env, CI: "1", CF_SEND_TELEMETRY: "false", NODE_ENV: "test" };

beforeAll(() => {
  execFileSync("vp", ["build", "--mode", "staging"], {
    cwd: portal,
    stdio: "pipe",
    env,
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
  expect(shell).not.toContain("/@id/");
  for (const [asset] of shell.matchAll(/\/assets\/[\w.-]+\.(?:js|css)/g))
    expect(existsSync(resolve(assets, asset.slice(1)))).toBe(true);
  expect(existsSync(resolve(assets, "login/index.html"))).toBe(false);
});

test("the staging client ships production React even when the shell sets NODE_ENV", () => {
  const scripts = readdirSync(resolve(assets, "assets")).filter((file) => file.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts)
    expect(readFileSync(resolve(assets, "assets", script), "utf8")).not.toContain(
      "registerInternalModuleStart",
    );
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
  expect(ofType("workflow")).toHaveLength(11);
  // Decisions, settlement refreshes, invoice payments and MoMo refunds wake the edge's workflows from the portal.
  for (const [binding, exportName] of [
    ["MOMO_REFUND", "MomoRefundWorkflow"],
    ["SETTLEMENT", "SettlementWorkflow"],
    ["APPROVAL", "ApprovalWorkflow"],
    ["BILLING", "BillingWorkflow"],
    // Sign-up, setup and the first sale move a shop's onboarding; an owner's submission starts its KYB.
    ["ONBOARDING_FLOWS", "OnboardingWorkflow"],
    ["KYB_FLOWS", "KybWorkflow"],
  ])
    expect(worker().env[binding]).toMatchObject({ type: "workflow", exportName });
  // A store added in the portal starts its store day at once, not at the next watchdog.
  expect(worker().env.STORE_DAY).toMatchObject({
    type: "workflow",
    exportName: "StoreDayWorkflow",
  });
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

test("a dry-run deploy validates the staging build without credentials", () => {
  const home = mkdtempSync(resolve(tmpdir(), "shopper-cf-home-"));
  const clean = Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.startsWith("CLOUDFLARE_")),
  );
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "../../tooling/cloudflare/deploy.ts", "portal", "--dry-run"],
    {
      cwd: portal,
      encoding: "utf8",
      env: { ...clean, HOME: home, XDG_CONFIG_HOME: home },
    },
  );
  expect(result.stderr).not.toContain("Refusing");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("--dry-run: exiting now");
});
