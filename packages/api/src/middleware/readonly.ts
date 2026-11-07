import type { MiddlewareHandler } from "hono";
import { isReadOnly } from "@shopper/core/billing";
import type { ApiEnvironment, ApiOptions } from "../types";

/** Paths that keep working while the back office is read-only: billing itself, sign-in, providers and registers. */
const OPEN = /^\/(?:billing|licence|api\/auth|webhooks|sync|payments|approvals$)(?:\/|$)/;

/**
 * Fourteen days after an unpaid invoice, or on a box whose licence is locked (60 days without a check-in), the back
 * office turns read-only: a member's changes get 402, while reads, billing, the licence, sign-in, provider webhooks
 * and every register keep working.
 */
export function readOnlyGuard(options: ApiOptions): MiddlewareHandler<ApiEnvironment> {
  return async (c, next) => {
    if (
      !options.authentication ||
      ["GET", "HEAD", "OPTIONS"].includes(c.req.method) ||
      OPEN.test(c.req.path)
    )
      return next();
    const principal = await options.authentication.resolvePrincipal(c.req.raw);
    if (!principal || principal.deviceId) return next();
    if ((await options.licence?.status())?.state === "locked")
      return c.json(
        {
          error:
            "The licence needs a check-in, so the back office is read-only. Tills keep selling.",
        },
        402,
      );
    if (options.database && (await isReadOnly(options.database, principal.orgId)))
      return c.json(
        { error: "The back office is read-only until the Shopper invoice is paid." },
        402,
      );
    return next();
  };
}
