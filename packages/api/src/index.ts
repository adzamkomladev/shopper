import { DeviceError, type createDeviceService } from "@shopper/auth/devices";
import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import * as v from "valibot";
import { and, desc, eq, lte } from "drizzle-orm";
import { taxRule, type ShopperDatabase } from "@shopper/db-pg";
import {
  managementId,
  managementJson,
  readManagement,
  mutateManagement,
  ManagementError,
  type ManagementKind,
} from "@shopper/core/management";
import { dateSchema } from "@shopper/tax";
import { requirePermission, type ApiAuthentication, type ApiEnvironment } from "./auth-middleware";
import { catalogueRoutes } from "./catalogue-routes";

export { requirePermission, type ApiAuthentication, type ApiPrincipal } from "./auth-middleware";

export interface ApiOptions {
  authentication?: ApiAuthentication;
  database?: ShopperDatabase;
  devices?: ReturnType<typeof createDeviceService>;
  // Populated by the authenticated session adapter; never derive this from request parameters.
  resolveOrgId?: (request: Request) => Promise<string | null>;
}
export function createApi(options: ApiOptions = {}) {
  const app = new Hono<ApiEnvironment>();
  app.use("*", async (c, next) => {
    await next();
    c.header("Shopper-Version", buildInfo.version);
  });
  app.get("/", (c) => c.json({ name: "Shopper", status: "hello" }));
  app.get("/health", (c) => c.json({ status: "ok", build: buildInfo }));
  app.get("/about", (c) => c.json(buildInfo));
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
  if (options.database)
    app.route(
      "/",
      catalogueRoutes({ database: options.database, authentication: options.authentication }),
    );
  if (options.authentication?.handler)
    app.all("/api/auth/*", (c) => options.authentication!.handler!(c.req.raw));
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
  if (options.devices) {
    for (const [path, operation, permission] of [
      ["/devices/enrollment", "issueEnrollment", "device.enroll"],
      ["/devices/enroll", "enroll", null],
      ["/cashiers/pin", "assignPin", "cashier.pin.assign"],
      ["/cashiers/login", "login", null],
      ["/devices/revoke", "revoke", "device.revoke"],
    ] as const) {
      if (permission) app.use(path, requirePermission(options.authentication, permission));
      app.post(path, async (c) => {
        const principal = c.get("principal");
        let data: unknown;
        try {
          data = await c.req.json();
        } catch {
          return c.json({ error: "Invalid JSON" }, 400);
        }
        try {
          const service = options.devices!;
          const result =
            operation === "enroll"
              ? await service.enroll(data)
              : operation === "login"
                ? await service.login(data)
                : operation === "issueEnrollment"
                  ? await service.issueEnrollment(principal!, data)
                  : operation === "assignPin"
                    ? await service.assignPin(principal!, data)
                    : await service.revoke(principal!, data);
          return c.json(
            result,
            operation === "enroll" || operation === "issueEnrollment" ? 201 : 200,
          );
        } catch (error) {
          if (v.isValiError(error)) return c.json({ error: "Invalid request data" }, 400);
          if (error instanceof DeviceError) return c.json({ error: error.message }, error.status);
          throw error;
        }
      });
    }
  }
  return app;
}
