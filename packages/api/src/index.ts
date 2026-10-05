import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import * as v from "valibot";
import { and, desc, eq, lte } from "drizzle-orm";
import { taxRule, type ShopperDatabase } from "@shopper/db-pg";
import { dateSchema } from "@shopper/tax";

export interface ApiOptions {
  database?: ShopperDatabase;
  // Populated by the authenticated session adapter; never derive this from request parameters.
  resolveOrgId?: (request: Request) => Promise<string | null>;
}
export function createApi(options: ApiOptions = {}) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    await next();
    c.header("Shopper-Version", buildInfo.version);
  });
  app.get("/", (c) => c.json({ name: "Shopper", status: "hello" }));
  app.get("/health", (c) => c.json({ status: "ok", build: buildInfo }));
  app.get("/about", (c) => c.json(buildInfo));
  app.get("/tax-rules", async (c) => {
    const orgId = await options.resolveOrgId?.(c.req.raw);
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
