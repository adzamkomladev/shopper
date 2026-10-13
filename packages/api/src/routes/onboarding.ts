import { Hono } from "hono";
import { AuthLinkError, type createOnboarding } from "@shopper/auth";
import { problem } from "../middleware/problem";

export function onboardingRoutes(service: ReturnType<typeof createOnboarding>) {
  const app = new Hono();
  app.onError((error, c) =>
    error instanceof AuthLinkError
      ? c.json({ error: error.message }, error.status)
      : problem(error, c),
  );
  app.get("/onboarding/:id", async (c) =>
    c.json(
      await service.get({
        id: c.req.param("id"),
        ...(c.req.query("resendToken")
          ? { resendToken: c.req.query("resendToken") }
          : { token: c.req.query("token") }),
      }),
    ),
  );
  for (const [path, operation] of [
    ["/onboarding/start", "start"],
    ["/onboarding/verify", "verify"],
    ["/onboarding/complete", "complete"],
    ["/onboarding/:id/resend", "resend"],
  ] as const) {
    app.post(path, async (c) => {
      let data: unknown;
      try {
        data = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON" }, 400);
      }
      if (operation === "resend") {
        if (!data || typeof data !== "object" || Array.isArray(data))
          return c.json({ error: "Invalid request data" }, 400);
        return c.json(await service.resend({ ...data, id: c.req.param("id") }));
      }
      return c.json(await service[operation](data), operation === "start" ? 201 : 200);
    });
  }
  return app;
}
