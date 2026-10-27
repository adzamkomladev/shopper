import type { MiddlewareHandler } from "hono";
import { isReadOnly } from "@shopper/core/billing";
import type { ApiEnvironment, ApiOptions } from "../types";

/** Paths that keep working while the back office is read-only: billing itself, sign-in, providers and registers. */
const OPEN = /^\/(?:billing|api\/auth|webhooks|sync|payments|approvals$)(?:\/|$)/;

/**
 * Fourteen days after an unpaid invoice the back office turns read-only: a member's changes get 402 until it is
 * paid, while reads, billing, sign-in, provider webhooks and every register keep working.
 */
export function readOnlyGuard(options: ApiOptions): MiddlewareHandler<ApiEnvironment> {
  return async (c, next) => {
    if (
      !options.database ||
      !options.authentication ||
      ["GET", "HEAD", "OPTIONS"].includes(c.req.method) ||
      OPEN.test(c.req.path)
    )
      return next();
    const principal = await options.authentication.resolvePrincipal(c.req.raw);
    if (principal && !principal.deviceId && (await isReadOnly(options.database, principal.orgId)))
      return c.json(
        { error: "The back office is read-only until the Shopper invoice is paid." },
        402,
      );
    return next();
  };
}
