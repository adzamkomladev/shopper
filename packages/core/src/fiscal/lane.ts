import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { fiscalDoc, type ShopperDatabase } from "@shopper/db-pg";

/** How long a lane waits before trying its head again: 30s, doubling, at most an hour. */
export const laneBackoff = (attempts: number) =>
  Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 3_600_000);

/** How long a document may wait for its enqueue before a draining lane adopts it. */
export const STRANDED_AFTER_MS = 60_000;

/**
 * A store's documents that still wait for the SDC but sit in no lane: an enqueue lost between the commit and the lane,
 * or a box restart. A lane adopts the `ready` ones when it drains; `later` says a younger one may still be on its way,
 * so the lane looks again after the cutoff instead of racing that enqueue.
 */
export async function strandedFiscalDocs(
  db: ShopperDatabase,
  scope: { orgId: string; storeId: string },
  before: Date,
  queued: string[],
) {
  const rows = await db
    .select({ id: fiscalDoc.id, createdAt: fiscalDoc.createdAt })
    .from(fiscalDoc)
    .where(
      and(
        eq(fiscalDoc.orgId, scope.orgId),
        eq(fiscalDoc.storeId, scope.storeId),
        inArray(fiscalDoc.status, ["pending", "submitted"]),
        queued.length ? notInArray(fiscalDoc.id, queued) : undefined,
      ),
    )
    .orderBy(asc(fiscalDoc.createdAt), asc(fiscalDoc.id));
  return {
    ready: rows.filter((row) => row.createdAt < before).map((row) => row.id),
    later: rows.some((row) => row.createdAt >= before),
  };
}

/** Every store with documents still waiting for the SDC; a box starts their lanes at boot. */
export async function waitingFiscalStores(db: ShopperDatabase) {
  return db
    .selectDistinct({ orgId: fiscalDoc.orgId, storeId: fiscalDoc.storeId })
    .from(fiscalDoc)
    .where(inArray(fiscalDoc.status, ["pending", "submitted"]));
}
