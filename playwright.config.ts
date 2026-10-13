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
        /(?:auth\.setup|(?:onboarding|public-states|invitations\/(?:accept|states))\.spec)\.ts$/,
      dependencies: ["setup"],
      use: { baseURL: "http://localhost:5183", storageState: "tests/e2e/.auth/owner.json" },
    },
    { name: "till-ui", testDir: "tests/e2e/till-ui", use: { baseURL: "http://localhost:5184" } },
  ],
  webServer: [
    {
      command:
        "tsx tooling/database/e2e.ts && vp run -F @shopper/box build && bun apps/box/dist/index.js",
      url: "http://localhost:3101/orgs/e2e-mart",
      env: boxEnvironment,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: "vp run -F @shopper/portal dev -- --port 5183 --strictPort",
      // The entry module is only served once Vite has finished pre-bundling dependencies.
      url: "http://localhost:5183/src/index.tsx",
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
