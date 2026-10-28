import { defineConfig } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tooling/database/e2e";
import { PLATFORM_ORG } from "./tooling/database/platform";
import { e2eRun } from "./tooling/e2e/run";

// SHOPPER_RUN_ID gives the run its own database, bucket, ports and build folders (tooling/e2e/run.ts).
const reuseExistingServer = !process.env.CI;
const portal = e2eRun.url(5183);
const tillUi = e2eRun.url(5184);
const admin = e2eRun.url(5187);
const boxEnvironment = {
  PORT: String(e2eRun.port(3101)),
  DATABASE_URL: E2E_DATABASE_URL,
  SHOPPER_AUTH_URL: portal,
  SHOPPER_AUTH_SECRET: "e2e-only-secret-more-than-32-characters",
  SHOPPER_BOOTSTRAP_TOKEN: "e2e-only-bootstrap-token",
  SHOPPER_LINK_SECRET: "e2e-only-link-secret-more-than-32-characters",
  SHOPPER_S3_ENDPOINT: "http://127.0.0.1:9200",
  SHOPPER_S3_BUCKET: e2eRun.bucket,
  SHOPPER_S3_ACCESS_KEY_ID: "shopper_dev_access",
  SHOPPER_S3_SECRET_ACCESS_KEY: "shopper_dev_secret_at_least_32_chars",
  SHOPPER_S3_REGION: "us-east-1",
  SHOPPER_CACHE_PATH: e2eRun.path(".shopper/e2e-cache.sqlite", "box/cache.sqlite"),
  SHOPPER_BUILD_OUT_DIR: e2eRun.outDir,
};

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  // Specs spawn the till host from apps/till/host/dist; build it once before any of them run.
  // A named run also creates its bucket, and its teardown drops the database, bucket and folders.
  globalSetup: ["./tests/support/prebuild.ts", "./tooling/e2e/global.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  outputDir: e2eRun.id ? `test-results/${e2eRun.id}` : "test-results",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: portal },
    },
    {
      name: "portal",
      testDir: "tests/e2e/portal",
      // The public specs run against their own API and portal: see playwright.public.config.ts.
      testIgnore:
        /(?:auth\.setup|(?:onboarding|setup\/\w+|public\/states|invitations\/(?:accept|states))\.spec)\.ts$/,
      dependencies: ["setup"],
      use: { baseURL: portal, storageState: e2eRun.ownerState },
    },
    { name: "till-ui", testDir: "tests/e2e/till/ui", use: { baseURL: tillUi } },
    { name: "admin", testDir: "tests/e2e/admin", use: { baseURL: admin } },
  ],
  webServer: [
    {
      command:
        // Built with the box's own script so a named run writes apps/box/.runs/<id>, not dist/.
        `tsx tooling/database/e2e.ts && vp -C apps/box exec node ../../tooling/build/server.mjs box && bun apps/box/${e2eRun.outDir}/index.js`,
      url: `${e2eRun.url(3101)}/orgs/e2e-mart`,
      env: boxEnvironment,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: `node tooling/build/portal/e2e.mjs && bun ${e2eRun.portalHost}/server.js`,
      url: `${portal}/api/orgs/e2e-mart`,
      env: { E2E_DATABASE_URL, SHOPPER_AUTH_URL: portal },
      timeout: 180_000,
      reuseExistingServer,
    },
    {
      command: `node tooling/build/portal/e2e.mjs admin && bun ${e2eRun.adminHost}/server.js`,
      url: `${admin}/api/platform/org`,
      // Its own Arkesel fake port: the portal host holds 3104.
      env: {
        E2E_DATABASE_URL,
        SHOPPER_AUTH_URL: admin,
        SHOPPER_PLATFORM_ORG: PLATFORM_ORG,
        E2E_ARKESEL_PORT: String(e2eRun.port(3105)),
      },
      timeout: 180_000,
      reuseExistingServer,
    },
    {
      command: `vp run -F @shopper/till-ui dev -- --port ${e2eRun.port(5184)} --strictPort`,
      url: tillUi,
      // Connection specs put their bridge proxy on 5186 (tests/support/till/connection/proxy.ts).
      env: { SHOPPER_TILL_HOST_URL: `http://127.0.0.1:${e2eRun.port(5186)}` },
      reuseExistingServer,
    },
  ],
});
