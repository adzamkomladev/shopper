import { buildInfo } from "@shopper/config";
import { Hono } from "hono";
import * as v from "valibot";
import { buildSnapshot } from "@shopper/core/changes";
import { fiscalSignatures } from "@shopper/core/fiscal";
import { negotiateProtocol } from "@shopper/sync/versions";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { createDeviceService } from "@shopper/auth/devices";
import { signaturesRequest } from "../schemas/sync/snapshot";

export function createSnapshotRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  protocol: number;
  blobs?: Blobs;
}) {
  return (
    new Hono()
      .get("/sync/snapshot", async (c) => {
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
      })
      // A till that caught up through a snapshot asks for the signatures its skipped feed rows carried.
      .post("/sync/snapshot/signatures", async (c) => {
        const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
        if (!principal) return c.json({ error: "Invalid device credential" }, 401);
        const parsed = v.safeParse(signaturesRequest, await c.req.json());
        if (!parsed.success) return c.json({ error: "Malformed signatures request" }, 400);
        return c.json({
          signatures: await fiscalSignatures(options.database, principal, parsed.output),
        });
      })
  );
}
