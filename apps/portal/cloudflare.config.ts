import { bindings, defineConfig } from "cf/config";

const accountId = "bd9ef997b398c9aeeee8ac3d3618efdc";
// Account infrastructure identifiers, not secrets. They match apps/edge/cloudflare.config.ts.
const ids = {
  dev: {
    hyperdrive: "dd6330074f7e4d0abbc989ad2028e72c",
    d1: "2485dba5-588e-49e3-8bf5-bd2cd5fbce16",
  },
  staging: {
    hyperdrive: "dfa4e3a17ca546ed8213ed257912db3f",
    d1: "44230678-333c-446c-af51-22fe0c8eb20e",
  },
} as const;
const localPostgres = "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper";
const secrets = [
  "SHOPPER_AUTH_SECRET",
  "SHOPPER_LINK_SECRET",
  "PAYSTACK_SECRET_KEY",
  "SHOPPER_S3_ACCESS_KEY_ID",
  "SHOPPER_S3_SECRET_ACCESS_KEY",
];

export default defineConfig(({ mode }) => {
  const stage = mode === "staging" ? "staging" : "dev";
  // The Durable Objects and Workflows live in the edge Worker; apps never import each other,
  // so the portal names it.
  const edge = `shopper-edge-${stage}`;
  const workflow = (flow: string) => `shopper-${flow}-${stage}`;
  const remoteInDev = stage === "dev" ? { dev: { remote: true } } : {};
  return {
    accountId,
    worker: {
      name: `shopper-portal-${stage}`,
      entrypoint: "src/worker.ts",
      compatibilityDate: "2026-10-05",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true, traces: { enabled: true } },
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*", "/_serverFn/*"],
      },
      ...(stage === "staging" ? { domains: ["shopper-staging.temtem.dev"] } : {}),
      env: {
        ASSETS: bindings.assets(),
        SHOPPER_ENVIRONMENT: bindings.text(stage),
        SHOPPER_AUTH_URL: bindings.text(
          stage === "staging" ? "https://shopper-staging.temtem.dev" : "http://localhost:5173",
        ),
        CACHE_DB: bindings.d1({ name: `shopper-cache-${stage}`, id: ids[stage].d1 }),
        HYPERDRIVE: bindings.hyperdrive({
          id: ids[stage].hyperdrive,
          dev: { connectionString: localPostgres },
        }),
        BLOBS: bindings.r2({ name: `shopper-assets-${stage}` }),
        IMPORTS: bindings.r2({ name: `shopper-imports-${stage}`, ...remoteInDev }),
        RECEIPTS: bindings.r2({ name: `shopper-receipts-${stage}`, ...remoteInDev }),
        NOTIFICATIONS: bindings.queue({ name: `shopper-notifications-${stage}` }),
        STORE_SEQUENCER: bindings.durableObject({ worker: edge, exportName: "StoreSequencer" }),
        STORE_HUB: bindings.durableObject({ worker: edge, exportName: "StoreHub" }),
        PRICE_CHANGE: bindings.workflow({
          name: workflow("price-change"),
          worker: edge,
          exportName: "PriceChangeWorkflow",
        }),
        AUTH_FLOWS: bindings.workflow({
          name: workflow("auth-flow"),
          worker: edge,
          exportName: "AuthWorkflow",
        }),
        MOMO_PAYMENT: bindings.workflow({
          name: workflow("momo-payment"),
          worker: edge,
          exportName: "MomoPaymentWorkflow",
        }),
        BROWSER: bindings.browser({}),
        SHOPPER_S3_BUCKET: bindings.text(`shopper-imports-${stage}`),
        SHOPPER_S3_RECEIPTS_BUCKET: bindings.text(`shopper-receipts-${stage}`),
        SHOPPER_S3_ENDPOINT: bindings.text(`https://${accountId}.r2.cloudflarestorage.com`),
        SHOPPER_S3_REGION: bindings.text("auto"),
        ...Object.fromEntries(secrets.map((secret) => [secret, bindings.secret()])),
      },
    },
  };
});
