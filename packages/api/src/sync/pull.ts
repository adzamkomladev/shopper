import { Hono } from "hono";
import * as v from "valibot";
import { MAX_PULL_LIMIT, pullChanges } from "@shopper/core/changes";
import { sequenceSchema } from "@shopper/ports";
import { negotiateProtocol } from "@shopper/sync/versions";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";

const query = v.object({
  cursor: sequenceSchema,
  limit: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+$/),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(MAX_PULL_LIMIT),
    ),
    String(MAX_PULL_LIMIT),
  ),
});

/** `GET /sync/changes`: a device's store change feed, read-only and so not audited. */
export function createPullRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  protocol: number;
}) {
  return new Hono().get("/sync/changes", async (c) => {
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
      ),
    );
  });
}
