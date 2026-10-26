import { Hono } from "hono";
import * as v from "valibot";
import { listShifts, readShift } from "@shopper/core/shifts";
import { managementId } from "@shopper/core/management";
import type { ShopperDatabase } from "@shopper/db-pg";
import { branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment, ApiPrincipal } from "../types";

/** Closed shifts and their Z reports for the back office, behind `shift.read`. */
export function shiftRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/shifts", requirePermission(authentication, "shift.read"));
  app.use("/shifts/*", requirePermission(authentication, "shift.read"));
  const scope = (c: { get(key: "principal"): ApiPrincipal }) => branchScope(c.get("principal"));
  app.get("/shifts", async (c) =>
    c.json(await listShifts(database, c.get("principal").orgId, scope(c))),
  );
  app.get("/shifts/:id", async (c) => {
    const id = v.safeParse(managementId, c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid shift id" }, 400);
    const found = await readShift(database, c.get("principal").orgId, id.output, scope(c));
    return found ? c.json(found) : c.json({ error: "Shift not found" }, 404);
  });
  return app;
}
