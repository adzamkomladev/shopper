import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e/till/ui",
  timeout: 60_000,
  // Specs spawn the till host from apps/till/host/dist; build it once before any of them run.
  globalSetup: "./tests/support/prebuild.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: "test-results/connection",
  use: { baseURL: "http://localhost:5187", trace: "retain-on-failure" },
  webServer: [
    {
      command: "vp run -F @shopper/till-ui dev -- --port 5187 --strictPort",
      url: "http://localhost:5187",
      env: { SHOPPER_TILL_HOST_URL: "http://127.0.0.1:5186" },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
