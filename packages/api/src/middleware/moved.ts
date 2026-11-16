import type { MiddlewareHandler } from "hono";
import { ne } from "drizzle-orm";
import type { createDeviceService } from "@shopper/auth/devices";
import { cloudMove, type ShopperDatabase } from "@shopper/db-pg";
import { leavingMove } from "@shopper/export";
import type { ApiAuthentication } from "../types";

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

/**
 * The cloud's side: a shop moving onto its own box only reads from the start of its move (its archive's snapshot is
 * taken next) and for good once it is archived. Members' changes are refused, except signing in, the move itself and
 * the archive it downloads; registers are refused in the sync routes (`refuseRegistersWhileLeaving`).
 */
export function refuseWhileLeaving(
  db: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
): MiddlewareHandler {
  const open = /^\/(?:api\/auth|migration|export\/archives|sync)(?:\/|$)/;
  return async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || open.test(c.req.path)) return next();
    const principal = await authentication?.resolvePrincipal(c.req.raw);
    const leaving = principal && (await leavingMove(db, principal.orgId));
    return leaving ? c.json({ error: leftFor(leaving.status) }, 423) : next();
  };
}

/** A register's uploads to a leaving shop stay in its outbox and go to the box once it has relocated there. */
export function refuseRegistersWhileLeaving(
  db: ShopperDatabase,
  devices: Pick<ReturnType<typeof createDeviceService>, "resolveUploadPrincipal">,
): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "GET" || c.req.path === "/sync/handshake") return next();
    const principal = await devices.resolveUploadPrincipal(c.req.raw);
    const leaving = principal && (await leavingMove(db, principal.orgId));
    return leaving ? c.json({ error: leftFor(leaving.status) }, 423) : next();
  };
}

const leftFor = (status: string) =>
  status === "archived"
    ? "This shop now runs on its own box. Make changes there."
    : "This shop is moving to its own box. Changes wait until the move is done or called off.";
