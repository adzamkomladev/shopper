import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { branchFulfilmentOf, OrderError, saveFulfilment } from "@shopper/core/orders";
import { managementId } from "@shopper/core/management";
import { assertBranch } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/** A branch's online ordering: pickup, delivery and its fee, hours and slots, read and saved on the branch screen. */
export function fulfilmentRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  app.onError((error, c) => {
    if (error instanceof OrderError) return c.json({ error: error.message }, error.status);
    if (v.isValiError(error))
      return c.json({ error: "Invalid request data", issues: v.flatten(error.issues).nested }, 400);
    throw error;
  });
  const path = "/branches/:id/fulfilment";
  app.get(path, requirePermission(options.authentication, "branch.read"), async (c) => {
    if (!options.database) return c.json({ error: "Database unavailable" }, 503);
    const id = v.parse(managementId, c.req.param("id"));
    assertBranch(c.get("principal"), id);
    return c.json(await branchFulfilmentOf(options.database, c.get("principal").orgId, id));
  });
  app.put(path, requirePermission(options.authentication, "branch.write"), async (c) => {
    if (!options.database) return c.json({ error: "Database unavailable" }, 503);
    const principal = c.get("principal");
    const id = v.parse(managementId, c.req.param("id"));
    assertBranch(principal, id);
    const values = await c.req.json().catch(() => null);
    return c.json(
      await saveFulfilment(
        options.database,
        {
          orgId: principal.orgId,
          actorId: principal.userId,
          role: principal.roleName,
          deviceId: principal.deviceId,
          branchId: principal.branchId,
          appVersion: buildInfo.version,
        },
        { branchId: id, values },
      ),
    );
  });
  return app;
}
