import { bindings, defineConfig, exports, triggers } from "cf/config";

const accountId = "bd9ef997b398c9aeeee8ac3d3618efdc";
// Hyperdrive and D1 ids are account infrastructure identifiers, not secrets.
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
// Credentials stay secrets; everything else the S3 signer needs is plain configuration.
const secrets = [
  "SHOPPER_AUTH_SECRET",
  "SHOPPER_AUTH_URL",
  "SHOPPER_LINK_SECRET",
  "MAILEROO_API_KEY",
  "MAILEROO_FROM",
  "PAYSTACK_SECRET_KEY",
  "ARKESEL_API_KEY",
  "SHOPPER_S3_ACCESS_KEY_ID",
  "SHOPPER_S3_SECRET_ACCESS_KEY",
];

export default defineConfig(({ mode }) => {
  const stage = mode === "staging" ? "staging" : "dev";
  const name = `shopper-edge-${stage}`;
  const workflow = (flow: string) => `shopper-${flow}-${stage}`;
  const remoteInDev = stage === "dev" ? { dev: { remote: true } } : {};
  return {
    accountId,
    worker: {
      name,
      entrypoint: "src/index.ts",
      compatibilityDate: "2026-10-05",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true, traces: { enabled: true } },
      ...(stage === "staging"
        ? { workersDev: true, domains: ["shopper-api-staging.temtem.dev"] }
        : {}),
      // Failed notifications retry five times, then land in the dead-letter queue. The config
      // loader cannot import workspace packages; edge.test.ts pins these to NOTIFICATION_RETRY.
      triggers: [
        triggers.queue({
          name: `shopper-notifications-${stage}`,
          deadLetterQueue: `shopper-notifications-dlq-${stage}`,
          maxRetries: 5,
          retryDelay: 60,
          maxBatchSize: 10,
        }),
        // The one daily watchdog: 23:59 UTC is Accra's end of day all year (no DST).
        triggers.scheduled({ schedule: "59 23 * * *" }),
      ],
      env: {
        CACHE_DB: bindings.d1({ name: `shopper-cache-${stage}`, id: ids[stage].d1 }),
        HYPERDRIVE: bindings.hyperdrive({
          id: ids[stage].hyperdrive,
          dev: { connectionString: localPostgres },
        }),
        BLOBS: bindings.r2({ name: `shopper-assets-${stage}` }),
        IMPORTS: bindings.r2({ name: `shopper-imports-${stage}`, ...remoteInDev }),
        RECEIPTS: bindings.r2({ name: `shopper-receipts-${stage}`, ...remoteInDev }),
        NOTIFICATIONS: bindings.queue({ name: `shopper-notifications-${stage}` }),
        STORE_SEQUENCER: bindings.durableObject({ worker: name, exportName: "StoreSequencer" }),
        STORE_HUB: bindings.durableObject({ worker: name, exportName: "StoreHub" }),
        FISCAL_LANE: bindings.durableObject({ worker: name, exportName: "FiscalLane" }),
        PRICE_CHANGE: bindings.workflow({
          name: workflow("price-change"),
          worker: name,
          exportName: "PriceChangeWorkflow",
        }),
        AUTH_FLOWS: bindings.workflow({
          name: workflow("auth-flow"),
          worker: name,
          exportName: "AuthWorkflow",
        }),
        KYC_FLOWS: bindings.workflow({
          name: workflow("kyc"),
          worker: name,
          exportName: "KycWorkflow",
        }),
        ACCOUNT_FLOWS: bindings.workflow({
          name: workflow("account"),
          worker: name,
          exportName: "AccountWorkflow",
        }),
        STATEMENT_FLOWS: bindings.workflow({
          name: workflow("statements"),
          worker: name,
          exportName: "StatementWorkflow",
        }),
        FISCAL_ARCHIVE: bindings.workflow({
          name: workflow("fiscal-archive"),
          worker: name,
          exportName: "FiscalArchiveWorkflow",
        }),
        AUDIT_ANCHOR: bindings.workflow({
          name: workflow("audit-anchor"),
          worker: name,
          exportName: "AuditAnchorWorkflow",
        }),
        MOMO_PAYMENT: bindings.workflow({
          name: workflow("momo-payment"),
          worker: name,
          exportName: "MomoPaymentWorkflow",
        }),
        BROWSER: bindings.browser({}),
        SHOPPER_S3_BUCKET: bindings.text(`shopper-imports-${stage}`),
        SHOPPER_S3_RECEIPTS_BUCKET: bindings.text(`shopper-receipts-${stage}`),
        SHOPPER_S3_ENDPOINT: bindings.text(`https://${accountId}.r2.cloudflarestorage.com`),
        SHOPPER_S3_REGION: bindings.text("auto"),
        // The registered Arkesel sender ID (11 characters at most).
        ARKESEL_SENDER: bindings.text("Shopper"),
        ...Object.fromEntries(secrets.map((secret) => [secret, bindings.secret()])),
        ...(stage === "dev" ? { SHOPPER_BOOTSTRAP_TOKEN: bindings.secret() } : {}),
      },
      // Declarative exports, not migrations: staging was first deployed with `exports` and
      // Cloudflare refuses to switch a Worker back to migrations (code 100403).
      exports: {
        StoreSequencer: exports.durableObject({ storage: "sqlite" }),
        StoreHub: exports.durableObject({ storage: "sqlite" }),
        FiscalLane: exports.durableObject({ storage: "sqlite" }),
        PriceChangeWorkflow: exports.workflow({ name: workflow("price-change") }),
        AuthWorkflow: exports.workflow({ name: workflow("auth-flow") }),
        MomoPaymentWorkflow: exports.workflow({ name: workflow("momo-payment") }),
        KycWorkflow: exports.workflow({ name: workflow("kyc") }),
        AccountWorkflow: exports.workflow({ name: workflow("account") }),
        StatementWorkflow: exports.workflow({ name: workflow("statements") }),
        FiscalArchiveWorkflow: exports.workflow({ name: workflow("fiscal-archive") }),
        AuditAnchorWorkflow: exports.workflow({ name: workflow("audit-anchor") }),
      },
    },
  };
});
