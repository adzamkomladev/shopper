import {
  cloudflareBlobs,
  cloudflareResponse,
  cloudflareLive,
  cloudflareRealtime,
  cloudflareCache,
  cloudflareDatabase,
  cloudflareLauncher,
  cloudflareSequencer,
} from "@shopper/adapters-cf";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";

import type { AuthEnvironment } from "./types";

export default {
  async fetch(request: Request, env: Env & AuthEnvironment) {
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
            baseUrl: env.SHOPPER_AUTH_URL,
            secret: new TextEncoder().encode(env.SHOPPER_AUTH_SECRET),
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
  },
};
