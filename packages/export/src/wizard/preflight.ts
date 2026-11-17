import { and, desc, eq, max } from "drizzle-orm";
import { exportJob, sale, type ShopperDatabase } from "@shopper/db-pg";

/** A sale this recent says the shop is still trading. */
const QUIET_MS = 15 * 60_000;
/** A dry run older than this no longer describes the shop. */
const FRESH_MS = 24 * 3_600_000;

/**
 * What an owner checks before freezing the shop for a move, in either direction: whether it looks closed (no sale in the
 * last quarter of an hour) and whether a dry run sealed the archive in the last day. Both only advise: a till that is
 * off keeps its sales in its outbox, and they follow the move.
 */
export async function preflight(db: ShopperDatabase, orgId: string, now = new Date()) {
  const [sold] = await db
    .select({ at: max(sale.occurredAt) })
    .from(sale)
    .where(eq(sale.orgId, orgId));
  const [sealed] = await db
    .select({ id: exportJob.id, at: exportJob.completedAt, bytes: exportJob.bytes })
    .from(exportJob)
    .where(and(eq(exportJob.orgId, orgId), eq(exportJob.status, "ready")))
    .orderBy(desc(exportJob.completedAt))
    .limit(1);
  const lastSale = sold?.at ?? null;
  return {
    quiet: {
      ok: !lastSale || now.getTime() - lastSale.getTime() >= QUIET_MS,
      lastSaleAt: lastSale?.toISOString() ?? null,
    },
    dryRun: {
      ok: !!sealed?.at && now.getTime() - sealed.at.getTime() < FRESH_MS,
      exportJobId: sealed?.id ?? null,
      sealedAt: sealed?.at?.toISOString() ?? null,
      minutes: sealed ? cutoverMinutes(sealed.bytes) : null,
    },
  };
}

/**
 * How long the shop stays frozen: sealing, carrying and importing the archive, then checking it.
 * shortcut: a fixed 10 MB a minute after a 2-minute floor, guessed for a pilot box on a shop line; measure a real
 * pilot move and replace the rate.
 */
export const cutoverMinutes = (bytes: number) => 2 + Math.ceil(bytes / (10 * 1024 * 1024));
