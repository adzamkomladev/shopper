import { defineConfig } from "@playwright/test";
import { e2eRun } from "./tooling/e2e/run";

const tillUi = e2eRun.url(5187);

export default defineConfig({
  testDir: "tests/e2e/till/ui",
  timeout: 60_000,
  // Specs spawn the till host from apps/till/host/dist; build it once before any of them run.
  globalSetup: "./tests/support/prebuild.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: e2eRun.id ? `test-results/${e2eRun.id}/connection` : "test-results/connection",
  use: { baseURL: tillUi, trace: "retain-on-failure" },
  webServer: [
    {
      command: `vp run -F @shopper/till-ui dev -- --port ${e2eRun.port(5187)} --strictPort`,
      url: tillUi,
      env: { SHOPPER_TILL_HOST_URL: `http://127.0.0.1:${e2eRun.port(5186)}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
