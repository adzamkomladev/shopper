import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  AdministrationError,
  listUsers,
  listRoles,
  listPermissions,
  grantedCodes,
} from "@shopper/auth";
import { stockBranches } from "@shopper/core/stock";
import { uuidV7Schema } from "@shopper/ports";
import { branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import { problem } from "../middleware/problem";
import type { ApiEnvironment, ApiOptions } from "../types";
import { administrationWrites } from "./administration/writes";

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
  // The branches someone managing access may grant: their own, or every branch.
  app.get("/users/branches", requirePermission(options.authentication, "role.write"), async (c) => {
    if (!options.database) return c.json({ error: "Database unavailable" }, 503);
    const principal = c.get("principal");
    return c.json(await stockBranches(options.database, principal.orgId, branchScope(principal)));
  });
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
  for (const write of administrationWrites) {
    app.on(
      write.method,
      write.path,
      requirePermission(options.authentication, write.code),
      async (c) => {
        if (!options.database) return c.json({ error: "Database unavailable" }, 503);
        const principal = c.get("principal");
        let body: unknown;
        if (write.json)
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: "Invalid JSON" }, 400);
          }
        const id = write.path.includes(":id") ? v.parse(uuidV7Schema, c.req.param("id")) : "";
        const result = await write.run(
          options.database,
          {
            orgId: principal.orgId,
            actorId: principal.userId,
            role: principal.roleName,
            deviceId: principal.deviceId,
            branchId: principal.branchId,
            appVersion: buildInfo.version,
          },
          id,
          body,
        );
        return result.status === 204 ? c.body(null, 204) : c.json(result.body, result.status);
      },
    );
  }
  return app;
}
