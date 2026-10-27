import { Hono, type Context } from "hono";
import * as v from "valibot";
import { readVatReturn, setVatReturnInput, taxSummary, vatReturnWorkbook } from "@shopper/core/tax";
import { taxSummaryQuery } from "@shopper/core/schemas";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "../stock/context";
import { problem } from "../../middleware/problem";
import { assertBranch, branchScope, requireOrgWide } from "../../middleware/require/branches";
import { requirePermission } from "../../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../../types";

/**
 * Tax reports for the back office: the summary by period, branch and class, and the monthly VAT return worksheet
 * with its Excel export (tax.read). Entering the input tax claimed needs tax.return.
 */
export function taxReportRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
) {
  const app = new Hono<ApiEnvironment>();
  const read = requirePermission(authentication, "tax.read");
  app.get("/tax/summary", read);
  app.get("/tax/returns/:period", read);
  app.get("/tax/returns/:period/export.xlsx", read);
  app.put("/tax/returns/:period/input", requirePermission(authentication, "tax.return"));
  // A VAT return covers the whole organisation: org-wide members only.
  app.use("/tax/returns/*", requireOrgWide);
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;

  app.get("/tax/summary", async (c) => {
    const range = v.parse(taxSummaryQuery, c.req.query());
    assertBranch(c.get("principal"), range.branchId);
    return c.json(await taxSummary(database, org(c), range, branchScope(c.get("principal"))));
  });
  app.get("/tax/returns/:period", async (c) =>
    c.json(await readVatReturn(database, org(c), c.req.param("period"))),
  );
  app.get("/tax/returns/:period/export.xlsx", async (c) => {
    const period = c.req.param("period");
    return c.body(await vatReturnWorkbook(database, org(c), period), 200, {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="vat-return-${period}.xlsx"`,
    });
  });
  app.put("/tax/returns/:period/input", async (c) => {
    await setVatReturnInput(database, commandContext(c.get("principal"), notifications), {
      period: c.req.param("period"),
      body: await c.req.json().catch(() => undefined),
    });
    return c.json(await readVatReturn(database, org(c), c.req.param("period")));
  });
  app.onError(problem);
  return app;
}
