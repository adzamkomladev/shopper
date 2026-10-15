import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vite-plus/test";

const portal = resolve("apps/portal");

test("the portal build prerenders a static SPA shell and routes only API and server functions to the Worker", () => {
  execFileSync("vp", ["build"], {
    cwd: portal,
    stdio: "pipe",
    env: { ...process.env, CI: "1", CLOUDFLARE_ENV: "staging" },
  });
  const shell = readFileSync(resolve(portal, "dist/client/index.html"), "utf8");
  expect(shell).toContain("<script");
  expect(shell).toContain("$tsr");
  expect(shell).not.toContain("Sign in");
  expect(existsSync(resolve(portal, "dist/client/login/index.html"))).toBe(false);
  const config = JSON.parse(readFileSync(resolve(portal, "dist/server/wrangler.json"), "utf8"));
  expect(config.assets).toMatchObject({
    binding: "ASSETS",
    not_found_handling: "single-page-application",
    run_worker_first: ["/api/*", "/_serverFn/*"],
  });
  expect(config.name).toBe("shopper-portal-staging");
  expect(config.vars.SHOPPER_ENVIRONMENT).toBe("staging");
  expect(config.durable_objects.bindings).toHaveLength(2);
  expect(config.workflows).toHaveLength(2);
  expect(config.queues.producers).toHaveLength(1);
  expect(config.hyperdrive).toHaveLength(1);
  expect(config.d1_databases).toHaveLength(1);
  expect(config.r2_buckets).toHaveLength(2);
}, 300_000);
