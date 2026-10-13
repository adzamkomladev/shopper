import { Hono } from "hono";
import { AdministrationError, AuthLinkError, type createInvitations } from "@shopper/auth";
import { requirePermission } from "../middleware/require-permission";
import { problem } from "../middleware/problem";
import type { ApiAuthentication, ApiEnvironment } from "../types";
export function invitationRoutes(
  service: ReturnType<typeof createInvitations>,
  authentication?: ApiAuthentication,
) {
  const app = new Hono<ApiEnvironment>();
  app.onError((error, c) =>
    error instanceof AuthLinkError || error instanceof AdministrationError
      ? c.json({ error: error.message }, error.status)
      : problem(error, c),
  );
  app.get("/invitations/:id/preview", async (c) =>
    c.json(await service.preview(c.req.param("id"), c.req.query("token") ?? "")),
  );
  app.post("/invitations/:id/accept", async (c) => {
    let data: unknown;
    try {
      data = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    return c.json(
      await service.accept(
        c.req.param("id"),
        data,
        (await authentication?.resolvePrincipal(c.req.raw)) ?? undefined,
      ),
    );
  });
  app.get("/invitations", requirePermission(authentication, "user.read"), async (c) =>
    c.json(await service.list(c.get("principal"))),
  );
  app.post("/invitations", requirePermission(authentication, "user.write"), async (c) => {
    let data: unknown;
    try {
      data = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    return c.json(await service.issue(c.get("principal"), data), 201);
  });
  for (const operation of ["reissue", "cancel"] as const)
    app.post(
      `/invitations/:id/${operation}`,
      requirePermission(authentication, "user.write"),
      async (c) => c.json(await service[operation](c.get("principal"), c.req.param("id"))),
    );
  return app;
}
