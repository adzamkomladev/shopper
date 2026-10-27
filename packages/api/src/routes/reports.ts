import { Hono, type Context } from "hono";
import {
  branchComparison,
  dashboard,
  deadStock,
  journalReport,
  productReport,
  reportCsv,
  reportTables,
  reportWorkbook,
  salesReport,
} from "@shopper/core/reports";
import { stockBranches } from "@shopper/core/stock";
import type { ShopperDatabase } from "@shopper/db-pg";
import { problem } from "../middleware/problem";
import { assertBranch, branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

type Report<T> = (
  db: ShopperDatabase,
  orgId: string,
  query: Record<string, string>,
  scope?: string[],
) => Promise<T>;

const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The back office's sales reports (report.read): the dashboard, sales by day, hour, branch, cashier and tender,
 * product performance and margin, branch comparison, dead stock and the accountant's journal, each also as CSV
 * and Excel. A branch-scoped member reads only their branches, and naming another branch is refused.
 */
export function reportRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/reports/*", requirePermission(authentication, "report.read"));
  const run = <T>(c: Context<ApiEnvironment>, report: Report<T>) => {
    const principal = c.get("principal");
    const query = c.req.query();
    assertBranch(principal, query.branchId);
    return report(database, principal.orgId, query, branchScope(principal));
  };
  const read = (report: Report<unknown>) => async (c: Context<ApiEnvironment>) =>
    c.json(await run(c, report));
  // The branches this reader may pick: a scoped member's own, else every branch.
  app.get(
    "/reports/scope",
    read((db, orgId, _query, scope) => stockBranches(db, orgId, scope)),
  );
  app.get("/reports/dashboard", read(dashboard));
  app.get("/reports/sales", read(salesReport));
  app.get("/reports/products", read(productReport));
  app.get("/reports/branches", read(branchComparison));
  app.get("/reports/stock/dead", read(deadStock));
  app.get("/reports/journal", read(journalReport));
  for (const [name, tabulate] of Object.entries(reportTables)) {
    app.get(`/reports/${name}/export.csv`, async (c) => {
      const table = await run(c, tabulate);
      return c.body(reportCsv(table), 200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${table.name}.csv"`,
      });
    });
    app.get(`/reports/${name}/export.xlsx`, async (c) => {
      const table = await run(c, tabulate);
      return c.body(reportWorkbook(table), 200, {
        "content-type": xlsx,
        "content-disposition": `attachment; filename="${table.name}.xlsx"`,
      });
    });
  }
  app.onError(problem);
  return app;
}
