import { Hono } from "hono";
import * as v from "valibot";
import { updateInstallInput } from "@shopper/core/release";
import { requirePermission } from "../middleware/require/permission";
import { BoxUpdateError, type ApiEnvironment, type ApiOptions } from "../types";

/**
 * The box's update bundles (`/updates`): what is in the updates folder and whether each may be installed, Install now,
 * Install after closing and Cancel. Cloud hosts have none and mount nothing. It is an owner's action, so it asks for
 * `billing.manage`, which on a box is the licence page's permission.
 */
export function updateRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const updates = options.updates;
  if (!updates) return app;
  const guard = requirePermission(options.authentication, "billing.manage");
  app.onError((error, c) =>
    error instanceof BoxUpdateError
      ? c.json({ error: error.message }, error.status)
      : c.json({ error: "Update failed" }, 500),
  );
  app.get("/updates", guard, async (c) => c.json(await updates.overview()));
  app.post("/updates/install", guard, async (c) => {
    const input = v.safeParse(updateInstallInput, await c.req.json().catch(() => undefined));
    if (!input.success) return c.json({ error: "Invalid request data" }, 400);
    const who = { orgId: c.get("principal").orgId, actorId: c.get("principal").userId };
    if (input.output.at) await updates.schedule(input.output.file, input.output.at, who);
    else await updates.install(input.output.file, who);
    return c.json(
      {
        status: input.output.at ? "scheduled" : "started",
        file: input.output.file,
        at: input.output.at,
      },
      input.output.at ? 201 : 202,
    );
  });
  app.post("/updates/cancel", guard, async (c) => {
    await updates.cancel();
    return c.body(null, 204);
  });
  return app;
}
