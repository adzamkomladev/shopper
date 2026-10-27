import { Hono } from "hono";
import * as v from "valibot";
import {
  dayReconciliation,
  reconciliationQuery,
  settlementId,
  settlementRefresh,
} from "@shopper/core/payments";
import { problem } from "../middleware/problem";
import { assertBranch, branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * Tender reconciliation for one trading day (report.read, within the reader's branches), and a refresh of that
 * day's Paystack settlements (payment.reconcile), which starts the settlement workflow again under a fresh id.
 */
export function reconciliationRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const permission = (request: Request) =>
    request.method === "GET" ? "report.read" : "payment.reconcile";
  app.use("/reconciliation", requirePermission(options.authentication, permission));
  app.use("/reconciliation/*", requirePermission(options.authentication, permission));
  app.get("/reconciliation", async (c) => {
    const principal = c.get("principal");
    const query = v.parse(reconciliationQuery, c.req.query());
    assertBranch(principal, query.branchId);
    return c.json(
      await dayReconciliation(options.database!, principal.orgId, query, branchScope(principal)),
    );
  });
  app.post("/reconciliation/settlements/refresh", async (c) => {
    if (!options.settlements) return c.json({ error: "Paystack is not set up" }, 503);
    const orgId = c.get("principal").orgId;
    const body = v.parse(settlementRefresh, await c.req.json());
    await options.settlements.start(`${settlementId(orgId, body.day)}-${Date.now()}`, {
      orgId,
      day: body.day,
    });
    return c.json({ started: true }, 202);
  });
  app.onError(problem);
  return app;
}
