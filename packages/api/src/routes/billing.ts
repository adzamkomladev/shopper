import { Hono } from "hono";
import { isReadOnly, readBilling } from "@shopper/core/billing";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The org's Shopper subscription and invoices with their checkout links, and on the box its licence (billing.manage);
 * open while read-only.
 */
export function billingRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  // Any member: the shell shows its read-only banner from this.
  app.get("/billing/status", async (c) => {
    const principal = await options.authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    const licence = await options.licence?.status();
    return c.json({
      readOnly: await isReadOnly(database, principal.orgId),
      // The box's licence state for the banner; the cloud has none.
      licence: licence
        ? { state: licence.state, reason: licence.reason, locksAt: licence.locksAt }
        : null,
    });
  });
  app.use("/billing", requirePermission(options.authentication, "billing.manage"));
  app.get("/billing", async (c) =>
    c.json({
      ...(await readBilling(database, c.get("principal").orgId)),
      licence: (await options.licence?.status()) ?? null,
    }),
  );
  app.onError(problem);
  return app;
}
