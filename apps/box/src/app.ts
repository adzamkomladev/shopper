import { Hono } from "hono";
import type { BoxBindings } from "./types";
import { boxCache, boxDatabase, boxPool, boxPriceChange, boxRealtime } from "@shopper/adapters-box";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(environment: Record<string, string | undefined> = process.env) {
  let cache: ReturnType<typeof boxCache> | undefined;
  let priceChange: ReturnType<typeof boxPriceChange> | undefined;
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
    const connection = await boxDatabase(DATABASE_URL);
    cache ??= boxCache(environment.SHOPPER_CACHE_PATH ?? ".shopper/cache.sqlite");
    // Created on first use, never at import: workflows outlive requests, so they get their own pool.
    priceChange ??= boxPriceChange({
      database: boxPool(DATABASE_URL).db,
      realtime: boxRealtime(),
    });
    try {
      return await serveRuntime(request, {
        database: connection.db,
        cache: cache.cache,
        secret: SHOPPER_AUTH_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        orgId: SHOPPER_ORG_ID,
        bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: context.env?.requestIP?.(request)?.address ?? "127.0.0.1",
        priceChange: priceChange.launcher,
      });
    } finally {
      await connection.close();
    }
  });
}
