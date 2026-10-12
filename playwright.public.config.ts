import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { E2E_DATABASE_URL } from "./tooling/database/e2e";

// Public onboarding runs against its own API shell (3102, with captured Maileroo on 3103) and its own
// portal (5185), so the registration routes are open while the standard box (3101) stays unchanged.
// The standard box entry is reused when it is up and only starts, and resets the database, when not.
const reuseExistingServer = !process.env.CI;
const box = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!box) throw new Error("The public harness needs the standard box server configuration.");

export default defineConfig({
  ...base,
  testDir: "tests/e2e/portal",
  // Each test waits out the 10s public rate-limit window, and the first page load pays for Vite's
  // dependency pre-bundling, so the default 30s test and 5s assertion budgets are too tight here.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  projects: [
    {
      name: "public",
      testMatch: /(?:onboarding|public-states|invitations\/(?:accept|states))\.spec\.ts/,
      use: { baseURL: "http://localhost:5185", navigationTimeout: 60_000 },
    },
  ],
  webServer: [
    box,
    {
      command: "node tooling/build/public-e2e.mjs && bun .shopper/public-e2e/public-server.js",
      url: "http://localhost:3102/orgs/e2e-mart",
      env: { E2E_DATABASE_URL, SHOPPER_AUTH_URL: "http://localhost:5185" },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: "vp run -F @shopper/portal dev -- --port 5185 --strictPort",
      url: "http://localhost:5185/src/index.tsx",
      env: { SHOPPER_API_URL: "http://localhost:3102" },
      timeout: 180_000,
      reuseExistingServer,
    },
  ],
});
