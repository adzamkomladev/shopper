import type { Change } from "./types";
export type { Change } from "./types";
import { notifyStoreChanged } from "@shopper/audit";
import { and, eq, sql } from "drizzle-orm";
import { branch, store, storeChange, type ShopperTransaction } from "@shopper/db-pg";

const ROWS_PER_INSERT = 1000;
export const FEED_VERSION = 3;

/**
 * Appends changes to each store's feed: one contiguous seq range per store, the sequence taken
 * by an UPDATE that locks the store row. Stores are locked in id order so concurrent callers
 * cannot deadlock. Call it last in a command; it returns each store's new head.
 */
export async function recordChanges(
  tx: ShopperTransaction,
  orgId: string,
  changes: Change[],
  storeIds: string[],
) {
  const heads = new Map<string, bigint>();
  if (!changes.length) return heads;
  for (const storeId of [...new Set(storeIds)].sort()) {
    const [row] = await tx
      .update(store)
      .set({ lastSeq: sql`${store.lastSeq} + ${changes.length}` })
      .where(and(eq(store.orgId, orgId), eq(store.id, storeId)))
      .returning({ head: store.lastSeq });
    if (!row) throw new Error("Store does not belong to this organization");
    const first = row.head - BigInt(changes.length) + 1n;
    for (let at = 0; at < changes.length; at += ROWS_PER_INSERT)
      await tx.insert(storeChange).values(
        changes.slice(at, at + ROWS_PER_INSERT).map((change, i) => ({
          orgId,
          storeId,
          seq: first + BigInt(at + i),
          entity: change.entity,
          entityId: change.entityId,
          op: change.op,
          v: FEED_VERSION,
          payload: change.payload,
        })),
      );
    heads.set(storeId, row.head);
    notifyStoreChanged(tx, storeId, row.head.toString());
  }
  return heads;
}

/** The stores a change reaches: every store of the org, or the one holding the branch. */
export async function affectedStores(
  tx: ShopperTransaction,
  orgId: string,
  branchId?: string | null,
) {
  const rows = branchId
    ? await tx
        .select({ id: branch.storeId })
        .from(branch)
        .where(and(eq(branch.orgId, orgId), eq(branch.id, branchId)))
    : await tx.select({ id: store.id }).from(store).where(eq(store.orgId, orgId));
  return rows.map((row) => row.id);
}
