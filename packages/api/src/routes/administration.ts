import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  AdministrationError,
  assignMemberRole,
  createRole,
  updateRole,
  listUsers,
  listRoles,
  listPermissions,
  grantedCodes,
} from "@shopper/auth";
import { roleAssignmentInput } from "@shopper/auth/schemas";
import { uuidV7Schema } from "@shopper/ports";
import { requirePermission } from "../middleware/require-permission";
import { problem } from "../middleware/problem";
import type { ApiEnvironment, ApiOptions } from "../types";

export function administrationRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  app.onError((error, c) => {
    if (error instanceof AdministrationError) return c.json({ error: error.message }, error.status);
    return problem(error, c);
  });
  for (const [path, code, read] of [
    ["/users", "user.read", listUsers],
    ["/roles", "role.read", listRoles],
    ["/permissions", "role.read", listPermissions],
  ] as const) {
    app.get(path, requirePermission(options.authentication, code), async (c) => {
      if (!options.database) return c.json({ error: "Database unavailable" }, 503);
      return c.json(await read(options.database, c.get("principal").orgId));
    });
  }
  app.get("/session/permissions", async (c) => {
    const principal = await options.authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    if (!options.database) return c.json({ error: "Database unavailable" }, 503);
    const codes = await grantedCodes(options.database, principal.orgId, principal.userId, {
      deviceId: principal.deviceId,
      roleId: principal.roleId,
    });
    return c.json(codes.map(({ code }) => code).sort());
  });
  for (const [method, path] of [
    ["POST", "/roles"],
    ["PATCH", "/roles/:id"],
    ["PATCH", "/users/:id/role"],
  ] as const) {
    app.on(method, path, requirePermission(options.authentication, "role.write"), async (c) => {
      if (!options.database) return c.json({ error: "Database unavailable" }, 503);
      const principal = c.get("principal");
      const context = {
        orgId: principal.orgId,
        actorId: principal.userId,
        role: principal.roleName,
        deviceId: principal.deviceId,
        branchId: principal.branchId,
        appVersion: buildInfo.version,
      };
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON" }, 400);
      }
      if (method === "POST") {
        const result = await createRole(options.database, context, body);
        return c.json(result.after, 201);
      }
      const id = v.parse(uuidV7Schema, c.req.param("id"));
      if (path === "/users/:id/role") {
        const input = v.parse(roleAssignmentInput, body);
        return c.json(await assignMemberRole(options.database, context, { userId: id, ...input }));
      }
      const result = await updateRole(options.database, context, { id, data: body });
      return c.json(result.after);
    });
  }
  return app;
}
