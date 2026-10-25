import { Hono, type Context } from "hono";
import { stream } from "hono/streaming";
import * as v from "valibot";
import {
  auditCsv,
  auditFacets,
  auditFilters,
  auditStreams,
  listAudit,
  readAudit,
  verifyStream,
} from "@shopper/core/audit";
import { managementId } from "@shopper/core/management";
import type { ShopperDatabase } from "@shopper/db-pg";
import { requirePermission } from "../middleware/require/permission";
import { auditStreamQuery } from "../schemas/audit";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/** The audit log for the back office, behind `audit.read`: entries, facets, export, streams and verification. */
export function auditRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/audit", requirePermission(authentication, "audit.read"));
  app.use("/audit/*", requirePermission(authentication, "audit.read"));
  const orgId = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  app.get("/audit", async (c) => {
    const filters = v.safeParse(auditFilters, c.req.query());
    if (!filters.success) return c.json({ error: "Invalid audit filters" }, 400);
    return c.json(await listAudit(database, orgId(c), filters.output));
  });
  app.get("/audit/facets", async (c) => c.json(await auditFacets(database, orgId(c))));
  app.get("/audit/streams", async (c) => c.json(await auditStreams(database, orgId(c))));
  app.get("/audit/verify", async (c) => {
    const query = v.safeParse(auditStreamQuery, c.req.query());
    if (!query.success) return c.json({ error: "Invalid stream" }, 400);
    return c.json(await verifyStream(database, orgId(c), query.output.stream));
  });
  // Registered before /audit/:id so "export.csv" is never read as an id.
  app.get("/audit/export.csv", async (c) => {
    const filters = v.safeParse(auditFilters, c.req.query());
    if (!filters.success) return c.json({ error: "Invalid audit filters" }, 400);
    c.header("content-type", "text/csv; charset=utf-8");
    c.header("content-disposition", 'attachment; filename="audit.csv"');
    const org = orgId(c);
    return stream(c, async (out) => {
      for await (const chunk of auditCsv(database, org, filters.output)) await out.write(chunk);
    });
  });
  app.get("/audit/:id", async (c) => {
    const id = v.safeParse(managementId, c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid audit entry id" }, 400);
    const found = await readAudit(database, orgId(c), id.output);
    return found ? c.json(found) : c.json({ error: "Audit entry not found" }, 404);
  });
  return app;
}
