import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { createPaystack } from "@shopper/core/payments/paystack";
import { deliverNotification } from "@shopper/core/notifications";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { createMaileroo } from "@shopper/auth";
import type { BoxBindings } from "./types";
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
  boxMomoPayment,
  boxQueue,
} from "@shopper/adapters-box";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(environment: Record<string, string | undefined> = process.env) {
  const realtime = boxRealtime();
  let workflowPool: ReturnType<typeof boxPool> | undefined;
  let cache: ReturnType<typeof boxCache> | undefined;
  let authFlows: ReturnType<typeof boxAuthFlows> | undefined;
  let kycFlows: ReturnType<typeof boxKycFlows> | undefined;
  let momoPayment: ReturnType<typeof boxMomoPayment> | undefined;
  let priceChange: ReturnType<typeof boxPriceChange> | undefined;
  let notifications: ReturnType<typeof boxQueue> | undefined;
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
    if (environment.PAYSTACK_SECRET_KEY)
      momoPayment ??= boxMomoPayment({
        withDatabase: (run) => run(workflowDatabase),
        realtime,
        appVersion: buildInfo.version,
        paystack: createPaystack({
          secretKey: environment.PAYSTACK_SECRET_KEY,
          baseUrl: environment.PAYSTACK_BASE_URL,
        }),
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
    // Alerts and statements share one queue; with no channel configured nothing is queued.
    if (sms || mail)
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
          },
          delivery,
        ),
      );
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
        renderer,
        sequencer: boxSequencer(connection.db),
        cache: cache.cache,
        realtime,
        live: boxLive(
          realtime,
          context.env?.upgrade ? { upgrade: context.env.upgrade.bind(context.env) } : undefined,
        ),
        blobs: (
          await boxBlobs(environment.SHOPPER_BLOBS_PATH ?? ".shopper/blobs", {
            baseUrl: SHOPPER_AUTH_URL,
            secret: new TextEncoder().encode(SHOPPER_AUTH_SECRET),
            objectStorage: s3(environment.SHOPPER_S3_BUCKET),
            receiptsObjectStorage: s3(environment.SHOPPER_S3_RECEIPTS_BUCKET),
          })
        ).blobs,
        secret: SHOPPER_AUTH_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        orgId: SHOPPER_ORG_ID,
        bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: context.env?.requestIP?.(request)?.address ?? "127.0.0.1",
        priceChange: priceChange.launcher,
        momoPayment,
        paystackSecret: environment.PAYSTACK_SECRET_KEY,
        authFlows,
        kyc: kycFlows,
        linkSecret: environment.SHOPPER_LINK_SECRET,
      });
    } finally {
      await connection.close();
    }
  });
}
