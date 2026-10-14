import { Hono } from "hono";
import * as v from "valibot";
import { and, desc, eq, lte } from "drizzle-orm";
import { taxRule } from "@shopper/db-pg";
import { dateSchema } from "@shopper/tax";
import { requirePermission } from "../../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../../types";

export function taxRuleRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  if (options.authentication)
    app.use("/tax-rules", requirePermission(options.authentication, "tax.read"));
  app.get("/tax-rules", async (c) => {
    const principal = c.get("principal");
    const orgId =
      principal?.orgId ??
      (!options.authentication ? await options.resolveOrgId?.(c.req.raw) : null);
    if (!orgId) return c.json({ error: "Authentication required" }, 401);
    if (!options.database) return c.json({ error: "Database unavailable" }, 503);
    const parsed = v.safeParse(dateSchema, c.req.query("on"));
    if (!parsed.success) return c.json({ error: "on must be a calendar date (YYYY-MM-DD)" }, 400);
    const [rule] = await options.database
      .select()
      .from(taxRule)
      .where(and(eq(taxRule.orgId, orgId), lte(taxRule.effectiveFrom, parsed.output)))
      .orderBy(desc(taxRule.effectiveFrom))
      .limit(1);
    if (!rule) return c.json({ error: "No tax rule for this date" }, 404);
    return c.json(rule);
  });
  return app;
}
