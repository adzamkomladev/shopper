import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
import { cloudflareBlobs, cloudflareCache } from "./storage";
import { cloudflareResponse } from "./response";
import { cloudflareLive } from "./live";
import { cloudflareRealtime } from "./realtime";
import { cloudflareQueue } from "./queue";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";
import { cloudflareSequencer } from "./sequencer";
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
  try {
    const response = await serveRuntime(request, {
      database: connection.db,
      sequencer: cloudflareSequencer(env.STORE_SEQUENCER),
      cache: cloudflareCache(env.CACHE_DB),
      live: cloudflareLive(env.STORE_HUB),
      realtime: cloudflareRealtime(env.STORE_HUB),
      notifications: env.NOTIFICATIONS
        ? cloudflareQueue(env.NOTIFICATIONS, NOTIFICATION_RETRY)
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
      secret: env.SHOPPER_AUTH_SECRET,
      baseURL: env.SHOPPER_AUTH_URL,
      bootstrapToken: env.SHOPPER_BOOTSTRAP_TOKEN,
      clientIP: request.headers.get("CF-Connecting-IP") ?? undefined,
      priceChange: cloudflareLauncher(env.PRICE_CHANGE),
      momoPayment:
        env.MOMO_PAYMENT && env.PAYSTACK_SECRET_KEY
          ? cloudflareLauncher(env.MOMO_PAYMENT)
          : undefined,
      paystackSecret: env.PAYSTACK_SECRET_KEY,
      authFlows: env.AUTH_FLOWS ? cloudflareLauncher(env.AUTH_FLOWS) : undefined,
      kyc:
        env.KYC_FLOWS && env.ARKESEL_API_KEY && env.ARKESEL_SENDER
          ? cloudflareLauncher(env.KYC_FLOWS)
          : undefined,
      linkSecret: env.SHOPPER_LINK_SECRET,
      publicOnboarding: true,
    });
    return cloudflareResponse(response);
  } finally {
    await connection.close();
  }
}
