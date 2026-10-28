import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { E2E_DATABASE_URL } from "./tooling/database/e2e";
import { e2eRun } from "./tooling/e2e/run";

// Public onboarding runs against its own API shell (3102, with captured Maileroo on 3103) and its own
// portal (5185), so the registration routes are open while the standard box (3101) stays unchanged.
// The standard box entry is reused when it is up and only starts, and resets the database, when not.
// SHOPPER_RUN_ID shifts every port by the run's offset (tooling/e2e/run.ts).
const reuseExistingServer = !process.env.CI;
const portal = e2eRun.url(5185);
const box = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!box) throw new Error("The public harness needs the standard box server configuration.");
// The onboarding milestone enrols a browser-mode till, so the till UI dev server runs here too.
const tillUi = (Array.isArray(base.webServer) ? base.webServer : []).find((server) =>
  server.command.includes("@shopper/till-ui"),
);
if (!tillUi) throw new Error("The public harness needs the till UI server configuration.");

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
      testMatch:
        /(?:onboarding|setup\/\w+|public\/states|invitations\/(?:accept|states))\.spec\.ts/,
      use: { baseURL: portal, navigationTimeout: 60_000 },
    },
  ],
  webServer: [
    box,
    tillUi,
    {
      command: `node tooling/build/public/e2e.mjs && bun ${e2eRun.publicHost}/server.js`,
      url: `${e2eRun.url(3102)}/orgs/e2e-mart`,
      env: { E2E_DATABASE_URL, SHOPPER_AUTH_URL: portal },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `node tooling/build/portal/e2e.mjs && bun ${e2eRun.portalHost}/server.js`,
      url: `${portal}/api/orgs/e2e-mart`,
      env: {
        E2E_DATABASE_URL,
        SHOPPER_AUTH_URL: portal,
        E2E_PUBLIC_ONBOARDING: "1",
      },
      timeout: 180_000,
      reuseExistingServer,
    },
  ],
});
