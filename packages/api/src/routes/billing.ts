import { Hono } from "hono";
import { readBilling } from "@shopper/core/billing";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/** The org's Shopper subscription and invoices with their checkout links (billing.manage); open while read-only. */
export function billingRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  app.use("/billing", requirePermission(options.authentication, "billing.manage"));
  app.get("/billing", async (c) => c.json(await readBilling(database, c.get("principal").orgId)));
  app.onError(problem);
  return app;
}
