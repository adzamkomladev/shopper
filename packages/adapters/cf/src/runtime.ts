import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
import { cloudflareBlobs, cloudflareCache } from "./storage";
import { cloudflareResponse } from "./response";
import { cloudflareLive } from "./live";
import { cloudflareRealtime } from "./realtime";
import { cloudflareDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";
import { cloudflareSequencer } from "./sequencer";
import type { CloudflareRuntimeEnvironment } from "./runtime/types";

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
      blobs: (
        await cloudflareBlobs(env.BLOBS, {
          imports: env.IMPORTS,
          baseUrl: env.SHOPPER_AUTH_URL,
          secret: new TextEncoder().encode(env.SHOPPER_AUTH_SECRET),
          objectStorage: env.SHOPPER_S3_ENDPOINT
            ? {
                endpoint: env.SHOPPER_S3_ENDPOINT,
                bucket: env.SHOPPER_S3_BUCKET ?? "",
                accessKeyId: env.SHOPPER_S3_ACCESS_KEY_ID ?? "",
                secretAccessKey: env.SHOPPER_S3_SECRET_ACCESS_KEY ?? "",
                region: env.SHOPPER_S3_REGION ?? "",
              }
            : undefined,
        })
      ).blobs,
      secret: env.SHOPPER_AUTH_SECRET,
      baseURL: env.SHOPPER_AUTH_URL,
      bootstrapToken: env.SHOPPER_BOOTSTRAP_TOKEN,
      clientIP: request.headers.get("CF-Connecting-IP") ?? undefined,
      priceChange: cloudflareLauncher(env.PRICE_CHANGE),
      authFlows: env.AUTH_FLOWS ? cloudflareLauncher(env.AUTH_FLOWS) : undefined,
      linkSecret: env.SHOPPER_LINK_SECRET,
      publicOnboarding: true,
    });
    return cloudflareResponse(response);
  } finally {
    await connection.close();
  }
}
