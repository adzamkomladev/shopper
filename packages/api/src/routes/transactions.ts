import { Hono, type Context } from "hono";
import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { listTransactions, readTransaction, transactionsTable } from "@shopper/core/transactions";
import { reportCsv } from "@shopper/core/reports";
import { problem } from "../middleware/problem";
import { assertBranch, branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The transactions explorer (report.read): a page of sales and unapplied MoMo payments with counts per status, the
 * same rows as CSV, and one sale's drill-down. A branch-scoped member reads only their branches.
 */
export function transactionRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  app.use("/transactions", requirePermission(options.authentication, "report.read"));
  app.use("/transactions/*", requirePermission(options.authentication, "report.read"));
  const scoped = (c: Context<ApiEnvironment>) => {
    const principal = c.get("principal");
    const query = c.req.query();
    assertBranch(principal, query.branchId);
    return { orgId: principal.orgId, query, scope: branchScope(principal) };
  };
  app.get("/transactions", async (c) => {
    const read = scoped(c);
    return c.json(await listTransactions(database, read.orgId, read.query, read.scope));
  });
  app.get("/transactions/export.csv", async (c) => {
    const read = scoped(c);
    const table = await transactionsTable(database, read.orgId, read.query, read.scope);
    return c.body(reportCsv(table), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${table.name}.csv"`,
    });
  });
  app.get("/transactions/:id", async (c) => {
    const principal = c.get("principal");
    if (!v.is(uuidV7Schema, c.req.param("id")))
      return c.json({ error: "Transaction not found" }, 404);
    const found = await readTransaction(
      database,
      principal.orgId,
      c.req.param("id").toLowerCase(),
      branchScope(principal),
    );
    if (!found) return c.json({ error: "Transaction not found" }, 404);
    return c.json(found);
  });
  app.onError(problem);
  return app;
}
