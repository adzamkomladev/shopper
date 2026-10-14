import { query } from "../schemas/sync/pull";
import { Hono } from "hono";
import * as v from "valibot";
import { pullChanges } from "@shopper/core/changes";

import { negotiateProtocol } from "@shopper/sync/versions";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { and, eq } from "drizzle-orm";
import { store } from "@shopper/db-pg";

/** `GET /sync/changes`: a device's store change feed, read-only and so not audited. */
export function createPullRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  protocol: number;
}) {
  return new Hono()
    .get("/sync/status", async (c) => {
      const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
      if (!principal) return c.json({ error: "Invalid device credential" }, 401);
      const header = c.req.header("X-Shopper-Protocol");
      if (!header || !/^\d+$/.test(header)) return c.json({ error: "Missing sync protocol" }, 400);
      if (negotiateProtocol(options.protocol, Number(header)) === undefined)
        return c.json({ error: "Incompatible sync protocol" }, 409);
      const [row] = await options.database
        .select({ head: store.lastSeq })
        .from(store)
        .where(and(eq(store.orgId, principal.orgId), eq(store.id, principal.storeId)));
      if (!row) return c.json({ error: "Store not found" }, 404);
      return c.json({ head: String(row.head), serverTime: new Date().toISOString() });
    })
    .get("/sync/changes", async (c) => {
      const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
      if (!principal) return c.json({ error: "Invalid device credential" }, 401);
      const header = c.req.header("X-Shopper-Protocol");
      if (!header || !/^\d+$/.test(header)) return c.json({ error: "Missing sync protocol" }, 400);
      if (negotiateProtocol(options.protocol, Number(header)) === undefined)
        return c.json({ error: "Incompatible sync protocol" }, 409);
      const parsed = v.safeParse(query, c.req.query());
      if (!parsed.success) return c.json({ error: "Malformed sync query" }, 400);
      return c.json(
        await pullChanges(
          options.database,
          principal,
          BigInt(parsed.output.cursor),
          parsed.output.limit,
          parsed.output.bootstrapped === "true",
        ),
      );
    });
}
