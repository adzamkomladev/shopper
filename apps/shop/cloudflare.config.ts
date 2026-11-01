import { bindings, defineConfig } from "cf/config";

const accountId = "bd9ef997b398c9aeeee8ac3d3618efdc";

export default defineConfig(({ mode }) => {
  // A plain `vite build` already runs in mode "production", so the production release builds as "prod".
  const stage = mode === "staging" ? "staging" : mode === "prod" ? "production" : "dev";
  return {
    accountId,
    worker: {
      name: `shopper-shop-${stage}`,
      entrypoint: "src/worker.ts",
      compatibilityDate: "2026-10-05",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true, traces: { enabled: true } },
      env: {
        ASSETS: bindings.assets(),
        // The edge Worker runs the API; shopper routes reach it at the shop's own origin, so the cookie is first-party.
        API: bindings.worker({ worker: `shopper-edge-${stage}` }),
        // Empty: no Turnstile widget. Set per stage with the public sitekey whose secret the edge holds.
        TURNSTILE_SITEKEY: bindings.text(""),
      },
    },
  };
});
