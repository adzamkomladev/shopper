import { buildInfo } from "@shopper/config";
import { Hono } from "hono";
import { buildSnapshot } from "@shopper/core/changes";
import { negotiateProtocol } from "@shopper/sync/versions";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { createDeviceService } from "@shopper/auth/devices";

export function createSnapshotRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  protocol: number;
  blobs?: Blobs;
}) {
  return new Hono().get("/sync/snapshot", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const protocol = c.req.header("X-Shopper-Protocol");
    if (!protocol || !/^\d+$/.test(protocol))
      return c.json({ error: "Missing sync protocol" }, 400);
    if (negotiateProtocol(options.protocol, Number(protocol)) === undefined)
      return c.json({ error: "Incompatible sync protocol" }, 409);
    if (!options.blobs) return c.json({ error: "Snapshot storage unavailable" }, 503);
    const bytes = await buildSnapshot(options.database, options.blobs, principal, {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      appVersion: buildInfo.version,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/json",
        "content-encoding": "gzip",
        "cache-control": "no-store",
      },
    });
  });
}
