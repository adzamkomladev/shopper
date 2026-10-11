import { Hono } from "hono";
import type { ShopperDatabase } from "@shopper/db-pg";
import { findOrg, findOrgBySlug } from "@shopper/core/orgs";

/** Shop code lookup: public, read-only, and it reveals only the org id and name. */
export function orgRoutes(options: { database: ShopperDatabase; orgId?: string }) {
  const { database, orgId } = options;
  const app = new Hono();
  const notFound = { error: "Record not found" };
  app.get("/orgs/current", async (c) => {
    const org = orgId ? await findOrg(database, orgId) : null;
    return org ? c.json(org) : c.json(notFound, 404);
  });
  app.get("/orgs/:slug", async (c) => {
    const org = await findOrgBySlug(database, c.req.param("slug"));
    // The box serves one org; any other shop code is unknown here.
    return org && (!orgId || org.id === orgId.toLowerCase()) ? c.json(org) : c.json(notFound, 404);
  });
  return app;
}
