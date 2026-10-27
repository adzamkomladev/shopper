import { Hono, type Context } from "hono";
import {
  branchComparison,
  dashboard,
  deadStock,
  productReport,
  salesReport,
} from "@shopper/core/reports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { problem } from "../middleware/problem";
import { assertBranch, branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * The back office's sales reports (report.read): the dashboard, sales by day, hour, branch, cashier and tender,
 * product performance and margin, branch comparison and dead stock. A branch-scoped member reads only their
 * branches, and naming another branch is refused.
 */
export function reportRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/reports/*", requirePermission(authentication, "report.read"));
  const read =
    (
      run: (
        db: ShopperDatabase,
        orgId: string,
        query: Record<string, string>,
        scope?: string[],
      ) => Promise<unknown>,
    ) =>
    async (c: Context<ApiEnvironment>) => {
      const principal = c.get("principal");
      const query = c.req.query();
      assertBranch(principal, query.branchId);
      return c.json(await run(database, principal.orgId, query, branchScope(principal)));
    };
  app.get("/reports/dashboard", read(dashboard));
  app.get("/reports/sales", read(salesReport));
  app.get("/reports/products", read(productReport));
  app.get("/reports/branches", read(branchComparison));
  app.get("/reports/stock/dead", read(deadStock));
  app.onError(problem);
  return app;
}
