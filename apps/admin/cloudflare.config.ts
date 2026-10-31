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
  "ARKESEL_API_KEY",
  "SHOPPER_S3_ACCESS_KEY_ID",
  "SHOPPER_S3_SECRET_ACCESS_KEY",
];
// Hubtel is optional. A declared secret is required at deploy, so only dev declares these (dev
// loads declared keys alone from .dev.vars); on staging, `cf secret put` binds them undeclared.
const hubtel = ["HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_MERCHANT_ACCOUNT"];

export default defineConfig(({ mode }) => {
  const stage = mode === "staging" ? "staging" : "dev";
  // The Durable Objects and Workflows live in the edge Worker; apps never import each other, so the admin
  // app names it. It serves the same shared API as the portal, so its bindings are the portal's.
  const edge = `shopper-edge-${stage}`;
  const workflow = (flow: string) => `shopper-${flow}-${stage}`;
  const remoteInDev = stage === "dev" ? { dev: { remote: true } } : {};
  return {
    accountId,
    worker: {
      name: `shopper-admin-${stage}`,
      entrypoint: "src/worker.ts",
      compatibilityDate: "2026-10-05",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true, traces: { enabled: true } },
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
      },
      ...(stage === "staging" ? { domains: ["shopper-admin-staging.temtem.dev"] } : {}),
      env: {
        ASSETS: bindings.assets(),
        SHOPPER_ENVIRONMENT: bindings.text(stage),
        // Only members of this org get through `/api/platform/*`.
        SHOPPER_PLATFORM_ORG: bindings.text("shopper"),
        SHOPPER_AUTH_URL: bindings.text(
          stage === "staging"
            ? "https://shopper-admin-staging.temtem.dev"
            : "http://localhost:5187",
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
        // The edge's namespaces: one budget per client across every Worker that serves the API.
        RATE_AUTH: bindings.rateLimit({ namespace: "2601", simple: { limit: 5, period: 10 } }),
        RATE_PUBLIC: bindings.rateLimit({ namespace: "2602", simple: { limit: 30, period: 10 } }),
        RATE_ENROL: bindings.rateLimit({ namespace: "2603", simple: { limit: 10, period: 60 } }),
        RATE_CASHIER: bindings.rateLimit({ namespace: "2604", simple: { limit: 20, period: 60 } }),
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
        ONBOARDING_FLOWS: bindings.workflow({
          name: workflow("onboarding"),
          worker: edge,
          exportName: "OnboardingWorkflow",
        }),
        KYB_FLOWS: bindings.workflow({
          name: workflow("kyb"),
          worker: edge,
          exportName: "KybWorkflow",
        }),
        KYC_FLOWS: bindings.workflow({
          name: workflow("kyc"),
          worker: edge,
          exportName: "KycWorkflow",
        }),
        STORE_DAY: bindings.workflow({
          name: workflow("store-day"),
          worker: edge,
          exportName: "StoreDayWorkflow",
        }),
        MOMO_PAYMENT: bindings.workflow({
          name: workflow("momo-payment"),
          worker: edge,
          exportName: "MomoPaymentWorkflow",
        }),
        MOMO_REFUND: bindings.workflow({
          name: workflow("momo-refund"),
          worker: edge,
          exportName: "MomoRefundWorkflow",
        }),
        SETTLEMENT: bindings.workflow({
          name: workflow("settlement"),
          worker: edge,
          exportName: "SettlementWorkflow",
        }),
        APPROVAL: bindings.workflow({
          name: workflow("approval"),
          worker: edge,
          exportName: "ApprovalWorkflow",
        }),
        BILLING: bindings.workflow({
          name: workflow("billing"),
          worker: edge,
          exportName: "BillingWorkflow",
        }),
        BROWSER: bindings.browser({}),
        SHOPPER_S3_BUCKET: bindings.text(`shopper-imports-${stage}`),
        SHOPPER_S3_RECEIPTS_BUCKET: bindings.text(`shopper-receipts-${stage}`),
        SHOPPER_S3_ENDPOINT: bindings.text(`https://${accountId}.r2.cloudflarestorage.com`),
        SHOPPER_S3_REGION: bindings.text("auto"),
        // The registered Arkesel sender ID (11 characters at most).
        ARKESEL_SENDER: bindings.text("Shopper"),
        ...Object.fromEntries(
          [...secrets, ...(stage === "dev" ? hubtel : [])].map((secret) => [
            secret,
            bindings.secret(),
          ]),
        ),
      },
    },
  };
});
