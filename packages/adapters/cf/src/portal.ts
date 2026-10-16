import { probePortal, servePortal } from "@shopper/api/portal";
import type { PortalContext } from "@shopper/api/portal";
import { buildInfo } from "@shopper/config";
import { sql } from "drizzle-orm";
import { cloudflareDatabase } from "./database";
import { cloudflareRuntime } from "./runtime";
import type { CloudflareRuntimeEnvironment } from "./runtime/types";
export type { CloudflareRuntimeEnvironment } from "./runtime/types";
export type { PortalContext, PortalHealth, PortalHost } from "@shopper/api/portal";

export function cloudflarePortal(request: Request, env: CloudflareRuntimeEnvironment) {
  return servePortal(request, (request) => cloudflareRuntime(request, env));
}

/** The request context the portal Worker hands to TanStack Start; bindings never leave this package. */
export function cloudflarePortalContext(env: CloudflareRuntimeEnvironment): PortalContext {
  return {
    portalRuntime: (request) => cloudflarePortal(request, env),
    portalHost: () => ({
      version: buildInfo.version,
      environment: env.SHOPPER_ENVIRONMENT ?? "unknown",
      publicOnboarding: true,
    }),
    portalHealth: () =>
      probePortal({
        database: async () => {
          const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
          try {
            await connection.db.execute(sql`select 1`);
          } finally {
            await connection.close().catch(() => undefined);
          }
        },
        cache: () => env.CACHE_DB.prepare("select 1").first(),
        blobs: () => env.BLOBS.head("health/absent"),
      }),
  };
}
