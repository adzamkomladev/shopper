import type { MiddlewareHandler } from "hono";
import { isRelayOrg } from "@shopper/core/relay";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { ApiAuthentication } from "../types";

/**
 * A relay org (v1.5) is its on-prem box's projection: its cloud back office only reads, for every member and every
 * route but signing in. The box writes it through the relay; the catalogue lock in the database backs this up.
 */
export function refuseRelayEdits(
  db: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(c.req.method) ||
      /^\/api\/auth(?:\/|$)/.test(c.req.path)
    )
      return next();
    const principal = await authentication?.resolvePrincipal(c.req.raw);
    return principal && (await isRelayOrg(db, principal.orgId))
      ? c.json(
          {
            error: "This shop runs on its own box. Make changes there; this cloud copy only reads.",
          },
          423,
        )
      : next();
  };
}
