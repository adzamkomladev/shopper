import { Hono, type Context } from "hono";
import * as v from "valibot";
import { and, desc, eq, lte } from "drizzle-orm";
import { taxRule } from "@shopper/db-pg";
import { createTaxRule, deleteTaxRule, listTaxRules, updateTaxRule } from "@shopper/core/tax";
import { dateSchema } from "@shopper/tax";
import { commandContext } from "../stock/context";
import { problem } from "../../middleware/problem";
import { requirePermission } from "../../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../../types";

/**
 * The org's dated tax rules. `GET /tax-rules?on=` (a published URL) answers the rule in force on a date and
 * `GET /tax/rules` lists them all (tax.read); creating, editing and removing scheduled rules needs tax.write.
 */
export function taxRuleRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  if (options.authentication) {
    app.get("/tax-rules", requirePermission(options.authentication, "tax.read"));
    app.get("/tax/rules", requirePermission(options.authentication, "tax.read"));
    app.on(
      ["POST", "PATCH", "DELETE"],
      ["/tax/rules", "/tax/rules/:id"],
      requirePermission(options.authentication, "tax.write"),
    );
  }
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
  const { database } = options;
  if (!database || !options.authentication) return app;
  const run = (c: Context<ApiEnvironment>) =>
    commandContext(c.get("principal"), options.notifications);
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);
  app.get("/tax/rules", async (c) =>
    c.json({ rules: await listTaxRules(database, c.get("principal").orgId) }),
  );
  app.post("/tax/rules", async (c) =>
    c.json(await createTaxRule(database, run(c), { body: await body(c) }), 201),
  );
  app.patch("/tax/rules/:id", async (c) => {
    const updated = await updateTaxRule(database, run(c), {
      id: c.req.param("id"),
      body: await body(c),
    });
    return c.json(updated.after);
  });
  app.delete("/tax/rules/:id", async (c) => {
    await deleteTaxRule(database, run(c), { id: c.req.param("id") });
    return c.body(null, 204);
  });
  app.onError(problem);
  return app;
}
