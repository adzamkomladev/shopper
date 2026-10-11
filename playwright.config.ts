import { defineConfig } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tooling/e2e-database";

const reuseExistingServer = !process.env.CI;
const boxEnvironment = {
  PORT: "3101",
  DATABASE_URL: E2E_DATABASE_URL,
  SHOPPER_AUTH_URL: "http://localhost:5183",
  SHOPPER_AUTH_SECRET: "e2e-only-secret-more-than-32-characters",
  SHOPPER_BOOTSTRAP_TOKEN: "e2e-only-bootstrap-token",
  SHOPPER_CACHE_PATH: ".shopper/e2e-cache.sqlite",
};

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "portal",
      testDir: "tests/e2e/portal",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { baseURL: "http://localhost:5183", storageState: "tests/e2e/.auth/owner.json" },
    },
    { name: "till-ui", testDir: "tests/e2e/till-ui", use: { baseURL: "http://localhost:5184" } },
  ],
  webServer: [
    {
      command:
        "tsx tooling/e2e-database.ts && vp run -F @shopper/box build && bun apps/box/dist/index.js",
      url: "http://localhost:3101/orgs/e2e-mart",
      env: boxEnvironment,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: "vp run -F @shopper/portal dev -- --port 5183 --strictPort",
      url: "http://localhost:5183",
      env: { SHOPPER_API_URL: "http://localhost:3101" },
      reuseExistingServer,
    },
    {
      command: "vp run -F @shopper/till-ui dev -- --port 5184 --strictPort",
      url: "http://localhost:5184",
      reuseExistingServer,
    },
  ],
});
