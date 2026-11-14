import type { MiddlewareHandler } from "hono";
import { ne } from "drizzle-orm";
import { cloudMove, type ShopperDatabase } from "@shopper/db-pg";

/**
 * The box's move to the cloud once it has started (and not failed). Only a box holds `cloud_move`, and a box holds one
 * shop, so the row is found without an org.
 */
export async function activeCloudMove(db: ShopperDatabase) {
  const [row] = await db.select().from(cloudMove).where(ne(cloudMove.status, "failed")).limit(1);
  return row;
}

/**
 * From the moment a move starts the box only reads: what it accepted after the snapshot would never reach the cloud.
 * `open` names the writes that still work (sign-in, the move itself, a register's handshake). A till's refused
 * upload stays in its outbox and goes to the cloud once the register has relocated.
 */
export function refuseWhenMoved(db: ShopperDatabase, open: RegExp): MiddlewareHandler {
  return async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || open.test(c.req.path)) return next();
    if (await activeCloudMove(db))
      return c.json(
        { error: "This shop has moved to the cloud. Sign in to the cloud portal to make changes." },
        423,
      );
    return next();
  };
}
