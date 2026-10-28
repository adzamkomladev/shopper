import { Hono } from "hono";
import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { sessionUpload } from "../schemas/sync/session";
import { adoptSession } from "./offline";

/**
 * Device-authenticated adoption of an offline session ahead of a live request that carries only its proof
 * (MoMo, remote approvals). `adopted` is false when it does not follow from a live server session.
 */
export function createSessionRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
}) {
  const app = new Hono();
  app.post("/sync/sessions", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    return c.json({
      adopted: await adoptSession(
        options.database,
        principal,
        v.parse(sessionUpload, await c.req.json()),
      ),
    });
  });
  return app;
}
