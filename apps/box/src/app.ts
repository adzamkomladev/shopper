import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { deliverNotification } from "@shopper/core/notifications";
import { runWatchdog } from "@shopper/core/reports";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { createSdc } from "@shopper/core/fiscal";
import { createMaileroo } from "@shopper/auth";
import type { BoxBindings } from "./types";
import { boxPayments } from "./payments";
import {
  boxBlobs,
  boxLive,
  boxCache,
  boxSequencer,
  boxDatabase,
  boxPool,
  boxPriceChange,
  boxRealtime,
  boxAuthFlows,
  boxKycFlows,
  boxAccountFlows,
  boxStatementFlows,
  boxQueue,
  boxRateLimiter,
  boxLane,
  boxFiscalArchive,
  boxAuditAnchors,
  boxStoreDays,
  boxWatchdog,
} from "@shopper/adapters-box";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(environment: Record<string, string | undefined> = process.env) {
  const realtime = boxRealtime();
  const rateLimiter = boxRateLimiter();
  let workflowPool: ReturnType<typeof boxPool> | undefined;
  let cache: ReturnType<typeof boxCache> | undefined;
  let authFlows: ReturnType<typeof boxAuthFlows> | undefined;
  let kycFlows: ReturnType<typeof boxKycFlows> | undefined;
  let payments: ReturnType<typeof boxPayments> | undefined;
  let priceChange: ReturnType<typeof boxPriceChange> | undefined;
  let notifications: ReturnType<typeof boxQueue> | undefined;
  let accountFlows: ReturnType<typeof boxAccountFlows> | undefined;
  let statementFlows: ReturnType<typeof boxStatementFlows> | undefined;
  let lane: ReturnType<typeof boxLane> | undefined;
  let watchdog: ReturnType<typeof boxWatchdog> | undefined;
  let storeDays: ReturnType<typeof boxStoreDays> | undefined;
  const renderer = boxRenderer();
  return new Hono<{ Bindings: BoxBindings }>().all("*", async (context) => {
    const request = context.req.raw;
    if (isPublicRequest(request)) return publicApi.fetch(request);
    const {
      DATABASE_URL,
      SHOPPER_AUTH_SECRET,
      SHOPPER_AUTH_URL,
      SHOPPER_ORG_ID,
      SHOPPER_BOOTSTRAP_TOKEN,
    } = environment;
    if (!DATABASE_URL || !SHOPPER_AUTH_SECRET || !SHOPPER_AUTH_URL) return runtimeUnavailable();
    const s3 = (bucket?: string) =>
      environment.SHOPPER_S3_ENDPOINT && bucket
        ? {
            endpoint: environment.SHOPPER_S3_ENDPOINT,
            bucket,
            accessKeyId: environment.SHOPPER_S3_ACCESS_KEY_ID ?? "",
            secretAccessKey: environment.SHOPPER_S3_SECRET_ACCESS_KEY ?? "",
            region: environment.SHOPPER_S3_REGION ?? "",
          }
        : undefined;
    const blobs = async () =>
      (
        await boxBlobs(environment.SHOPPER_BLOBS_PATH ?? ".shopper/blobs", {
          baseUrl: SHOPPER_AUTH_URL,
          secret: new TextEncoder().encode(SHOPPER_AUTH_SECRET),
          objectStorage: s3(environment.SHOPPER_S3_BUCKET),
          receiptsObjectStorage: s3(environment.SHOPPER_S3_RECEIPTS_BUCKET),
        })
      ).blobs;
    const connection = await boxDatabase(DATABASE_URL);
    cache ??= boxCache(environment.SHOPPER_CACHE_PATH ?? ".shopper/cache.sqlite");
    workflowPool ??= boxPool(DATABASE_URL);
    const workflowDatabase = workflowPool.db;
    // Created on first use, never at import: workflows outlive requests, so they get their own pool.
    priceChange ??= boxPriceChange({
      database: workflowDatabase,
      realtime,
    });
    if (environment.SHOPPER_LINK_SECRET)
      authFlows ??= boxAuthFlows({
        withDatabase: (run) => run(workflowDatabase),
        linkSecret: environment.SHOPPER_LINK_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        mail:
          environment.MAILEROO_API_KEY && environment.MAILEROO_FROM
            ? createMaileroo({
                apiKey: environment.MAILEROO_API_KEY,
                from: environment.MAILEROO_FROM,
                endpoint: environment.MAILEROO_ENDPOINT,
              })
            : undefined,
      });
    payments ??= boxPayments(environment, {
      database: workflowDatabase,
      realtime,
      baseUrl: SHOPPER_AUTH_URL,
    });
    const sms = environment.ARKESEL_API_KEY
      ? createArkesel({
          apiKey: environment.ARKESEL_API_KEY,
          sender: environment.ARKESEL_SENDER ?? "Shopper",
          baseUrl: environment.ARKESEL_BASE_URL || undefined,
        })
      : undefined;
    const mail =
      environment.MAILEROO_API_KEY && environment.MAILEROO_FROM
        ? createMaileroo({
            apiKey: environment.MAILEROO_API_KEY,
            from: environment.MAILEROO_FROM,
            endpoint: environment.MAILEROO_ENDPOINT,
          })
        : undefined;
    // Alerts, statements, tier notices and account wakes share one queue; a channel it lacks retries.
    notifications ??= boxQueue(NOTIFICATION_RETRY, (delivery) =>
      deliverNotification(
        {
          db: workflowDatabase,
          appVersion: buildInfo.version,
          sms,
          mail,
          renderer,
          linkSecret: environment.SHOPPER_LINK_SECRET,
          baseUrl: SHOPPER_AUTH_URL,
          accounts: accountFlows,
          statements: statementFlows,
          refunds: payments?.momoRefund,
          queue: notifications,
        },
        delivery,
      ),
    );
    if (!statementFlows) {
      statementFlows = boxStatementFlows({
        withDatabase: (run) => run(workflowDatabase),
        appVersion: buildInfo.version,
        queue: notifications,
      });
      // On boot every monthly statement schedule starts again and runs a run day it missed.
      statementFlows
        .relaunch()
        .catch((error: unknown) => console.error({ event: "statement.relaunch_failed", error }));
    }
    if (!accountFlows) {
      accountFlows = boxAccountFlows({
        withDatabase: (run) => run(workflowDatabase),
        appVersion: buildInfo.version,
        queue: notifications,
      });
      // On boot every account with a ledger looks for its next due moment again.
      accountFlows
        .relaunch()
        .catch((error: unknown) => console.error({ event: "account.relaunch_failed", error }));
    }
    if (!storeDays) {
      storeDays = boxStoreDays({ database: workflowDatabase, queue: notifications });
      // The in-process engine forgets sleeping days on restart: every store's today starts again on boot.
      storeDays
        .relaunch()
        .catch((error: unknown) => console.error({ event: "store_day.relaunch_failed", error }));
    }
    if (!watchdog) {
      const anchors = boxAuditAnchors({ database: workflowDatabase, queue: notifications });
      const days = storeDays.launcher;
      const settled = payments.settlements?.launcher;
      // The box bills nobody: Shopper subscriptions are cloud only, so it starts no billing periods.
      watchdog = boxWatchdog((at) =>
        runWatchdog(
          {
            withDatabase: (run) => run(workflowDatabase),
            anchors: anchors.launcher,
            storeDays: days,
            settlements: settled,
          },
          at,
        ),
      );
    }
    if (!lane && environment.SHOPPER_SDC_URL && environment.SHOPPER_SDC_KEY) {
      const archive = boxFiscalArchive({ database: workflowDatabase, blobs: await blobs() });
      lane = boxLane({
        db: workflowDatabase,
        sdc: createSdc({ url: environment.SHOPPER_SDC_URL, apiKey: environment.SHOPPER_SDC_KEY }),
        appVersion: buildInfo.version,
        archive: archive.launcher,
      });
      // On boot every store with documents still waiting for the SDC gets its lane back, and its bundle.
      Promise.all([lane.relaunch(), archive.relaunch()]).catch((error: unknown) =>
        console.error({ event: "fiscal.relaunch_failed", error }),
      );
    }
    if (sms && environment.SHOPPER_LINK_SECRET)
      kycFlows ??= boxKycFlows({
        withDatabase: (run) => run(workflowDatabase),
        sms,
        linkSecret: environment.SHOPPER_LINK_SECRET,
      });
    try {
      return await serveRuntime(request, {
        database: connection.db,
        notifications,
        lane,
        renderer,
        sequencer: boxSequencer(connection.db),
        cache: cache.cache,
        rateLimiter,
        realtime,
        live: boxLive(
          realtime,
          context.env?.upgrade ? { upgrade: context.env.upgrade.bind(context.env) } : undefined,
        ),
        blobs: await blobs(),
        secret: SHOPPER_AUTH_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        orgId: SHOPPER_ORG_ID,
        bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: context.env?.requestIP?.(request)?.address ?? "127.0.0.1",
        priceChange: priceChange.launcher,
        momoPayment: payments.momoPayment,
        momoRefund: payments.momoRefund,
        hubtel: payments.hubtel,
        settlements: payments.settlements?.launcher,
        approvals: payments.approvals,
        paystackSecret: environment.PAYSTACK_SECRET_KEY,
        authFlows,
        kyc: kycFlows,
        storeDays: storeDays.launcher,
        linkSecret: environment.SHOPPER_LINK_SECRET,
      });
    } finally {
      await connection.close();
    }
  });
}
