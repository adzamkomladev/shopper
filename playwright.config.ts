import { defineConfig } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tooling/database/e2e";

const reuseExistingServer = !process.env.CI;
const boxEnvironment = {
  PORT: "3101",
  DATABASE_URL: E2E_DATABASE_URL,
  SHOPPER_AUTH_URL: "http://localhost:5183",
  SHOPPER_AUTH_SECRET: "e2e-only-secret-more-than-32-characters",
  SHOPPER_BOOTSTRAP_TOKEN: "e2e-only-bootstrap-token",
  SHOPPER_LINK_SECRET: "e2e-only-link-secret-more-than-32-characters",
  SHOPPER_S3_ENDPOINT: "http://127.0.0.1:9200",
  SHOPPER_S3_BUCKET: "shopper-imports-dev",
  SHOPPER_S3_ACCESS_KEY_ID: "shopper_dev_access",
  SHOPPER_S3_SECRET_ACCESS_KEY: "shopper_dev_secret_at_least_32_chars",
  SHOPPER_S3_REGION: "us-east-1",
  SHOPPER_CACHE_PATH: ".shopper/e2e-cache.sqlite",
};

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  // Specs spawn the till host from apps/till/host/dist; build it once before any of them run.
  globalSetup: "./tests/support/prebuild.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: "http://localhost:5183" },
    },
    {
      name: "portal",
      testDir: "tests/e2e/portal",
      // The public specs run against their own API and portal: see playwright.public.config.ts.
      testIgnore:
        /(?:auth\.setup|(?:onboarding|public\/states|invitations\/(?:accept|states))\.spec)\.ts$/,
      dependencies: ["setup"],
      use: { baseURL: "http://localhost:5183", storageState: "tests/e2e/.auth/owner.json" },
    },
    { name: "till-ui", testDir: "tests/e2e/till/ui", use: { baseURL: "http://localhost:5184" } },
  ],
  webServer: [
    {
      command:
        "tsx tooling/database/e2e.ts && vp run --no-cache -F @shopper/box build && bun apps/box/dist/index.js",
      url: "http://localhost:3101/orgs/e2e-mart",
      env: boxEnvironment,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: "node tooling/build/portal/e2e.mjs && bun .shopper/portal/e2e/server.js",
      url: "http://localhost:5183/api/orgs/e2e-mart",
      env: {
        E2E_DATABASE_URL,
        SHOPPER_AUTH_URL: "http://localhost:5183",
      },
      timeout: 180_000,
      reuseExistingServer,
    },
    {
      command: "vp run -F @shopper/till-ui dev -- --port 5184 --strictPort",
      url: "http://localhost:5184",
      reuseExistingServer,
    },
  ],
});
