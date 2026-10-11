import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  managementId,
  managementJson,
  readManagement,
  mutateManagement,
  ManagementError,
  type ManagementKind,
} from "@shopper/core/management";
import { requirePermission } from "../middleware/require-permission";
import type { ApiEnvironment, ApiOptions } from "../types";

// Stores and branches: one CRUD surface per management kind.
export function managementRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  for (const kind of ["store", "branch"] as const) {
    const collection = `/${kind === "store" ? "stores" : "branches"}`;
    for (const route of [collection, `${collection}/:id`]) {
      app.on(
        ["GET", "POST", "PATCH", "DELETE"],
        route,
        requirePermission(
          options.authentication,
          (request) => `${kind}.${request.method === "GET" ? "read" : "write"}`,
        ),
        async (c) => {
          const principal = c.get("principal");
          const action = c.req.method;
          if (!options.database) return c.json({ error: "Database unavailable" }, 503);
          const id = c.req.param("id");
          if ((action === "POST" && id) || ((action === "PATCH" || action === "DELETE") && !id))
            return c.json({ error: "Method not allowed" }, 405);
          if (id && !v.safeParse(managementId, id).success)
            return c.json({ error: "Invalid UUIDv7" }, 400);
          try {
            if (action === "GET") {
              const rows = await readManagement(
                options.database,
                principal.orgId,
                kind as ManagementKind,
                id,
              );
              if (id && !rows.length) return c.json({ error: "Record not found" }, 404);
              return c.json(managementJson(id ? rows[0] : rows));
            }
            let data: unknown;
            if (action !== "DELETE") {
              try {
                data = await c.req.json();
              } catch {
                return c.json({ error: "Invalid JSON" }, 400);
              }
            }
            const result = await mutateManagement(
              options.database,
              {
                orgId: principal.orgId,
                actorId: principal.userId,
                role: principal.roleName,
                deviceId: principal.deviceId,
                branchId: principal.branchId,
                appVersion: buildInfo.version,
              },
              {
                kind,
                action: action === "POST" ? "create" : action === "PATCH" ? "update" : "delete",
                id,
                data,
              },
            );
            if (action === "DELETE") return c.body(null, 204);
            return c.json(result.after, action === "POST" ? 201 : 200);
          } catch (error) {
            if (v.isValiError(error)) return c.json({ error: "Invalid request data" }, 400);
            if (error instanceof ManagementError)
              return c.json({ error: error.message }, error.status);
            const cause = error as { code?: string; cause?: { code?: string } };
            if ((cause.code ?? cause.cause?.code) === "23503")
              return c.json({ error: "Record is referenced by existing data" }, 409);
            throw error;
          }
        },
      );
    }
  }
  return app;
}
