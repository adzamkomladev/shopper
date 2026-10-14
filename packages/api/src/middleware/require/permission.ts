import type { MiddlewareHandler } from "hono";
import type { ApiAuthentication, ApiEnvironment } from "../../types";

export function requirePermission(
  authentication: ApiAuthentication | undefined,
  permission: string | ((request: Request) => string),
): MiddlewareHandler<ApiEnvironment> {
  return async (c, next) => {
    const principal = await authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    const code = typeof permission === "string" ? permission : permission(c.req.raw);
    if (!(await authentication!.hasPermission(principal, code)))
      return c.json({ error: "Permission denied" }, 403);
    c.set("principal", principal);
    await next();
  };
}
