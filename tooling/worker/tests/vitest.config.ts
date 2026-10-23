import { startBrowserFake } from "../../browser/server";
import { startPaystackFake } from "../../paystack/server";
import { startArkeselFake } from "../../arkesel/server";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { buildDefines } from "../../build/info";

// Rolldown lifts pg's optional pg-native require into an eager ESM import.
// esbuild preserves that lazy require, as it must for Workers without native addons.
const pgBundle = join(import.meta.dirname, ".vite/pg-workers.mjs");
await mkdir(join(import.meta.dirname, ".vite"), { recursive: true });
await build({
  entryPoints: [fileURLToPath(import.meta.resolve("pg"))],
  outfile: pgBundle,
  bundle: true,
  platform: "node",
  conditions: ["workerd"],
  format: "esm",
  external: ["pg-native", "cloudflare:sockets"],
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
const paystack = await startPaystackFake();
const browser = await startBrowserFake();
const arkesel = await startArkeselFake();
paystack.behave("0551234987", "success");
paystack.behave("0551234986", "send_otp");
paystack.behave("0241234567", "pending");
paystack.behave("0551234984", "error");
export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: { pg: pgBundle } },
  define: buildDefines,
  plugins: [
    { name: "paystack-fake", closeBundle: () => paystack.stop() },
    { name: "browser-fake", closeBundle: () => browser.stop() },
    { name: "arkesel-fake", closeBundle: () => arkesel.stop() },
    cloudflareTest({
      remoteBindings: false,
      experimental: { newConfig: { configPath: "../../../apps/edge/cloudflare.config.ts" } },
      miniflare: {
        // The config names this Worker explicitly; the pool runs it under its own runner name.
        durableObjects: {
          STORE_SEQUENCER: { className: "StoreSequencer", useSQLite: true },
          STORE_HUB: { className: "StoreHub", useSQLite: true },
        },
        bindings: {
          // Signing credentials never exist in tests; without an endpoint the grants stay off.
          SHOPPER_S3_ENDPOINT: "",
          BROWSER_FAKE_URL: browser.baseUrl,
          ARKESEL_API_KEY: arkesel.apiKey,
          ARKESEL_BASE_URL: arkesel.baseUrl,
          PAYSTACK_SECRET_KEY: paystack.secretKey,
          PAYSTACK_BASE_URL: paystack.baseUrl,
          SHOPPER_AUTH_SECRET: "integration-secret-with-at-least-32-characters",
          SHOPPER_AUTH_URL: "https://shopper.test",
          SHOPPER_BOOTSTRAP_TOKEN: "integration-bootstrap-token",
          SHOPPER_LINK_SECRET: "integration-link-secret-with-at-least-32-characters",
        },
        hyperdrives: {
          HYPERDRIVE:
            process.env.CF_TEST_DATABASE_URL ??
            process.env.TEST_DATABASE_URL ??
            "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper",
        },
      },
    }),
  ],
  test: {
    include: [
      "worker.test.ts",
      "portal.test.ts",
      "uploads.test.ts",
      "pull.test.ts",
      "realtime.test.ts",
      "price/change.test.ts",
      "launcher.test.ts",
      "payments/momo.test.ts",
      "kyc/flow.test.ts",
      "renderer.test.ts",
      "queue.test.ts",
      "stock/alerts.test.ts",
      "approvers.test.ts",
      "refunds.test.ts",
      "shifts.test.ts",
    ],
  },
});
