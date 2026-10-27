import { Hono } from "hono";
import { isReadOnly, readBilling } from "@shopper/core/billing";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/** The org's Shopper subscription and invoices with their checkout links (billing.manage); open while read-only. */
export function billingRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  // Any member: the shell shows its read-only banner from this.
  app.get("/billing/status", async (c) => {
    const principal = await options.authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    return c.json({ readOnly: await isReadOnly(database, principal.orgId) });
  });
  app.use("/billing", requirePermission(options.authentication, "billing.manage"));
  app.get("/billing", async (c) => c.json(await readBilling(database, c.get("principal").orgId)));
  app.onError(problem);
  return app;
}
