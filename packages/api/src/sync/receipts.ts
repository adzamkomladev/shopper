import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { confirmReceiptUpload, issueReceiptUpload } from "@shopper/assets";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { createDeviceService } from "@shopper/auth/devices";
import type { Principal } from "./types";

/** Device-authenticated receipt PDF upload: a presigned grant, then a server-side check of the stored bytes. */
export function createReceiptRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  blobs?: Blobs;
}) {
  const app = new Hono();
  const context = (principal: Principal) => ({
    orgId: principal.orgId,
    deviceId: principal.deviceId,
    branchId: principal.branchId,
    appVersion: buildInfo.version,
  });
  app.post("/sync/receipts", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    if (!options.blobs) return c.json({ error: "Direct uploads are unavailable" }, 503);
    const { saleId: _sale, ...grant } = await issueReceiptUpload(
      options.database,
      context(principal),
      { blobs: options.blobs, data: await c.req.json() },
    );
    return c.json(grant);
  });
  app.post("/sync/receipts/:assetId/confirm", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    if (!options.blobs) return c.json({ error: "Direct uploads are unavailable" }, 503);
    await confirmReceiptUpload(options.database, context(principal), {
      blobs: options.blobs,
      assetId: c.req.param("assetId"),
    });
    return c.json({ ok: true });
  });
  return app;
}
