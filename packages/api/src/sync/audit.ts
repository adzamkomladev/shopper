import { Hono } from "hono";
import * as v from "valibot";
import { deviceAuditUpload, ingestDeviceAudit } from "@shopper/core/audit";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";

/** Device-authenticated upload of the till's own audit chain. `rejected` is terminal for the till. */
export function createAuditRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
}) {
  const app = new Hono();
  app.post("/sync/audit", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const body = (await c.req.json()) as { requestId?: unknown };
    const data = v.safeParse(deviceAuditUpload, body);
    if (!data.success)
      return c.json({
        requestId: body?.requestId,
        rejected: { code: "INVALID_EVENT", message: "Invalid audit entries" },
      });
    const outcome = await ingestDeviceAudit(options.database, principal, data.output.entries);
    return c.json({
      requestId: data.output.requestId,
      ...("rejected" in outcome ? { rejected: outcome.rejected } : { accepted: outcome.accepted }),
    });
  });
  return app;
}
