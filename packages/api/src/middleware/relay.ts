import type { MiddlewareHandler } from "hono";
import { isRelayOrg } from "@shopper/core/relay";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import type { ApiAuthentication, ApiEnvironment } from "../types";

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

/**
 * On a box, a successful write to what its relay org's store shows (catalogue, stores, branches, fulfilment) wakes
 * the Publisher (v1.5), so the online store follows within seconds. A failed wake is logged, never the write's error.
 */
export function wakePublisher(publisher?: WorkflowLauncher): MiddlewareHandler<ApiEnvironment> {
  return async (c, next) => {
    await next();
    if (!publisher || c.req.method === "GET" || !c.res.ok) return;
    const orgId = c.get("principal").orgId;
    await publisher
      .start(orgId, { orgId })
      .catch((error: unknown) => console.error({ event: "relay.wake_failed", orgId, error }));
  };
}
