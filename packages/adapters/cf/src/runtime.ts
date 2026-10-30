import { createPaystack } from "@shopper/core/payments/paystack";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
import { cloudflareBlobs, cloudflareCache } from "./storage";
import { cloudflareResponse } from "./response";
import { cloudflareLive } from "./live";
import { cloudflareRealtime } from "./realtime";
import { cloudflareQueue } from "./queue";
import { cloudflareRenderer } from "./renderer";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";
import { cloudflareSequencer } from "./sequencer";
import { cloudflareLane } from "./lane";
import { cloudflareHubtel } from "./hubtel";
import { cloudflareRateLimiter } from "./ratelimit";
import type { CloudflareRuntimeEnvironment } from "./runtime/types";

const s3 = (env: CloudflareRuntimeEnvironment, bucket?: string) =>
  env.SHOPPER_S3_ENDPOINT && bucket
    ? {
        endpoint: env.SHOPPER_S3_ENDPOINT,
        bucket,
        accessKeyId: env.SHOPPER_S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.SHOPPER_S3_SECRET_ACCESS_KEY ?? "",
        region: env.SHOPPER_S3_REGION ?? "",
      }
    : undefined;

export async function cloudflareRuntime(
  request: Request,
  env: CloudflareRuntimeEnvironment,
): Promise<Response> {
  if (isPublicRequest(request)) return publicApi.fetch(request);
  if (!env.SHOPPER_AUTH_SECRET || !env.SHOPPER_AUTH_URL || !env.HYPERDRIVE)
    return runtimeUnavailable();
  const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
  const response = await serveRuntime(request, {
    database: connection.db,
    sequencer: cloudflareSequencer(env.STORE_SEQUENCER),
    cache: cloudflareCache(env.CACHE_DB),
    rateLimiter: cloudflareRateLimiter(env),
    live: cloudflareLive(env.STORE_HUB),
    realtime: cloudflareRealtime(env.STORE_HUB),
    notifications: env.NOTIFICATIONS
      ? cloudflareQueue(env.NOTIFICATIONS, NOTIFICATION_RETRY)
      : undefined,
    lane:
      env.FISCAL_LANE && env.SHOPPER_SDC_URL && env.SHOPPER_SDC_KEY
        ? cloudflareLane(env.FISCAL_LANE)
        : undefined,
    blobs: (
      await cloudflareBlobs(env.BLOBS, {
        imports: env.IMPORTS,
        baseUrl: env.SHOPPER_AUTH_URL,
        secret: new TextEncoder().encode(env.SHOPPER_AUTH_SECRET),
        receipts: env.RECEIPTS,
        objectStorage: s3(env, env.SHOPPER_S3_BUCKET),
        receiptsObjectStorage: s3(env, env.SHOPPER_S3_RECEIPTS_BUCKET),
      })
    ).blobs,
    renderer: env.BROWSER ? cloudflareRenderer(env.BROWSER) : undefined,
    secret: env.SHOPPER_AUTH_SECRET,
    baseURL: env.SHOPPER_AUTH_URL,
    bootstrapToken: env.SHOPPER_BOOTSTRAP_TOKEN,
    clientIP: request.headers.get("CF-Connecting-IP") ?? undefined,
    priceChange: cloudflareLauncher(env.PRICE_CHANGE),
    momoPayment:
      env.MOMO_PAYMENT && env.PAYSTACK_SECRET_KEY
        ? cloudflareLauncher(env.MOMO_PAYMENT)
        : undefined,
    momoRefund:
      env.MOMO_REFUND && env.PAYSTACK_SECRET_KEY ? cloudflareLauncher(env.MOMO_REFUND) : undefined,
    paystackSecret: env.PAYSTACK_SECRET_KEY,
    // Payouts go through subaccounts under Shopper's own Paystack account.
    platform: env.SHOPPER_PLATFORM_ORG ? { orgSlug: env.SHOPPER_PLATFORM_ORG } : undefined,
    kyb: env.PAYSTACK_SECRET_KEY
      ? createPaystack({ secretKey: env.PAYSTACK_SECRET_KEY, baseUrl: env.PAYSTACK_BASE_URL })
      : undefined,
    hubtel: cloudflareHubtel(env),
    settlements:
      env.SETTLEMENT && env.PAYSTACK_SECRET_KEY ? cloudflareLauncher(env.SETTLEMENT) : undefined,
    approvals: env.APPROVAL ? cloudflareLauncher(env.APPROVAL) : undefined,
    billing: env.BILLING ? cloudflareLauncher(env.BILLING) : undefined,
    authFlows: env.AUTH_FLOWS ? cloudflareLauncher(env.AUTH_FLOWS) : undefined,
    onboarding: env.ONBOARDING_FLOWS ? cloudflareLauncher(env.ONBOARDING_FLOWS) : undefined,
    kyc:
      env.KYC_FLOWS && env.ARKESEL_API_KEY && env.ARKESEL_SENDER
        ? cloudflareLauncher(env.KYC_FLOWS)
        : undefined,
    storeDays: env.STORE_DAY ? cloudflareLauncher(env.STORE_DAY) : undefined,
    linkSecret: env.SHOPPER_LINK_SECRET,
    publicOnboarding: true,
  }).catch(async (error: unknown) => {
    await connection.close();
    throw error;
  });
  if (!response.body) {
    await connection.close();
    return cloudflareResponse(response);
  }
  // A streamed body (the audit CSV) still queries as the client reads: close once it ends or is cancelled.
  const { readable, writable } = new TransformStream();
  void response.body
    .pipeTo(writable)
    .catch(() => undefined)
    .finally(() => connection.close());
  return cloudflareResponse(
    new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
}
