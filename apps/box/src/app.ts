import { Hono } from "hono";
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
} from "@shopper/adapters-box";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(environment: Record<string, string | undefined> = process.env) {
  const realtime = boxRealtime();
  let workflowPool: ReturnType<typeof boxPool> | undefined;
  let cache: ReturnType<typeof boxCache> | undefined;
  let authFlows: ReturnType<typeof boxAuthFlows> | undefined;
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
    try {
      return await serveRuntime(request, {
        database: connection.db,
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
            objectStorage: environment.SHOPPER_S3_ENDPOINT
              ? {
                  endpoint: environment.SHOPPER_S3_ENDPOINT,
                  bucket: environment.SHOPPER_S3_BUCKET ?? "",
                  accessKeyId: environment.SHOPPER_S3_ACCESS_KEY_ID ?? "",
                  secretAccessKey: environment.SHOPPER_S3_SECRET_ACCESS_KEY ?? "",
                  region: environment.SHOPPER_S3_REGION ?? "",
                }
              : undefined,
          })
        ).blobs,
        secret: SHOPPER_AUTH_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        orgId: SHOPPER_ORG_ID,
        bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: context.env?.requestIP?.(request)?.address ?? "127.0.0.1",
        priceChange: priceChange.launcher,
        authFlows,
        linkSecret: environment.SHOPPER_LINK_SECRET,
      });
    } finally {
      await connection.close();
    }
  });
}
