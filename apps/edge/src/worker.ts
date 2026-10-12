import { cloudflareCache, cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";

import type { AuthEnvironment } from "./types";

export default {
  async fetch(request: Request, env: Env & AuthEnvironment) {
    if (isPublicRequest(request)) return publicApi.fetch(request);
    if (!env.SHOPPER_AUTH_SECRET || !env.SHOPPER_AUTH_URL || !env.HYPERDRIVE)
      return runtimeUnavailable();
    const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
    try {
      return await serveRuntime(request, {
        database: connection.db,
        cache: cloudflareCache(env.CACHE_DB),
        secret: env.SHOPPER_AUTH_SECRET,
        baseURL: env.SHOPPER_AUTH_URL,
        bootstrapToken: env.SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: request.headers.get("CF-Connecting-IP") ?? undefined,
        priceChange: cloudflareLauncher(env.PRICE_CHANGE),
      });
    } finally {
      await connection.close();
    }
  },
};
