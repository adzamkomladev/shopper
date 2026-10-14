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
const portalWorkers = await Promise.all(
  [
    `import { cloudflarePortal } from "@shopper/adapters-cf/portal"; export default { fetch(request, env) { return cloudflarePortal(request, { API: env.API, ASSETS: env.ASSETS }); } };`,
    `import { cloudflarePortal } from "@shopper/adapters-cf/portal"; export default { fetch(request, env) { return cloudflarePortal(request, { ASSETS: env.ASSETS }); } };`,
  ].map(async (contents) => {
    const result = await build({
      stdin: { contents, resolveDir: import.meta.dirname, sourcefile: "portal.mjs" },
      bundle: true,
      conditions: ["workerd"],
      format: "esm",
      platform: "browser",
      write: false,
    });
    return result.outputFiles[0]!.text;
  }),
);
export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: { pg: pgBundle } },
  define: buildDefines,
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: { configPath: "../../../apps/edge/wrangler.jsonc" },
      miniflare: {
        bindings: {
          SHOPPER_AUTH_SECRET: "integration-secret-with-at-least-32-characters",
          SHOPPER_AUTH_URL: "https://shopper.test",
          SHOPPER_BOOTSTRAP_TOKEN: "integration-bootstrap-token",
          SHOPPER_LINK_SECRET: "integration-link-secret-with-at-least-32-characters",
        },
        serviceBindings: {
          PORTAL: "shopper-portal",
          PORTAL_NO_API: "shopper-portal-no-api",
        },
        workers: [
          {
            name: "shopper-api-fixture",
            modules: [
              {
                type: "ESModule",
                path: "api.mjs",
                contents: `export default { async fetch(request) { const url = new URL(request.url); return new Response(JSON.stringify({ pathname: url.pathname, search: url.search, method: request.method, body: await request.text(), origin: request.headers.get("Origin"), org: request.headers.get("X-Shopper-Org"), cookie: request.headers.get("Cookie") }), { status: 207, headers: { "content-type": "application/json", "set-cookie": "portal_session=forwarded; Path=/; HttpOnly; Secure; SameSite=None" } }); } };`,
              },
            ],
          },
          {
            name: "shopper-assets-fixture",
            modules: [
              {
                type: "ESModule",
                path: "assets.mjs",
                contents: `export default { async fetch() { return new Response("<!doctype html><title>portal asset</title>", { headers: { "content-type": "text/html" } }); } };`,
              },
            ],
          },
          {
            name: "shopper-portal",
            serviceBindings: {
              API: "shopper-api-fixture",
              ASSETS: "shopper-assets-fixture",
            },
            modules: [
              {
                type: "ESModule",
                path: "portal.mjs",
                contents: portalWorkers[0],
              },
            ],
          },
          {
            name: "shopper-portal-no-api",
            serviceBindings: { ASSETS: "shopper-assets-fixture" },
            modules: [
              {
                type: "ESModule",
                path: "portal-no-api.mjs",
                contents: portalWorkers[1],
              },
            ],
          },
        ],
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
    ],
  },
});
