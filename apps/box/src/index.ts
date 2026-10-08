import { Elysia } from "elysia";
import { boxDatabase, boxCache } from "@shopper/adapters-box";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(environment: Record<string, string | undefined> = process.env) {
  let cache: ReturnType<typeof boxCache> | undefined;
  return new Elysia()
    .onRequest(({ request, server }) => {
      request.headers.set(
        "X-Shopper-Client-IP",
        server?.requestIP(request)?.address ?? "127.0.0.1",
      );
    })
    .mount(async (request: Request) => {
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
      try {
        return await serveRuntime(request, {
          database: connection.db,
          cache: cache.cache,
          secret: SHOPPER_AUTH_SECRET,
          baseURL: SHOPPER_AUTH_URL,
          orgId: SHOPPER_ORG_ID,
          bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
          clientIP: request.headers.get("X-Shopper-Client-IP") ?? "127.0.0.1",
        });
      } finally {
        await connection.close();
      }
    });
}
export const app = createBoxApp();
if (import.meta.main) app.listen(Number(process.env.PORT ?? 3001));
