import type { PullPage } from "./types";
export type { PullPage } from "./types";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { store, storeChange, type ShopperDatabase } from "@shopper/db-pg";

export const MAX_PULL_LIMIT = 500;
const SNAPSHOT_THRESHOLD = 50_000;

/**
 * One page of a store's change feed. The head and the rows are read in a single REPEATABLE READ
 * snapshot, so a commit racing the read is either fully in the page or fully after the head.
 * A snapshot is requested for a fresh till (cursor 0), a server that was reset (cursor ahead of
 * the head) and a till more than SNAPSHOT_THRESHOLD change rows behind.
 */
export function pullChanges(
  database: ShopperDatabase,
  scope: { orgId: string; storeId: string },
  cursor: bigint,
  limit: number,
  bootstrapped = false,
): Promise<PullPage> {
  return database.transaction(
    async (tx) => {
      const [row] = await tx
        .select({ head: store.lastSeq })
        .from(store)
        .where(and(eq(store.orgId, scope.orgId), eq(store.id, scope.storeId)));
      if (!row) throw new Error("Store does not belong to this organization");
      const head = row.head;
      if ((!bootstrapped && cursor === 0n) || cursor > head)
        return { snapshot: true, head: String(head) };
      const pending = and(
        eq(storeChange.orgId, scope.orgId),
        eq(storeChange.storeId, scope.storeId),
        gt(storeChange.seq, cursor),
      );
      const rows = await tx
        .select()
        .from(storeChange)
        .where(pending)
        .orderBy(asc(storeChange.seq))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      if (hasMore) {
        // Fewer than a page can never exceed the threshold, so only a full page pays for the count.
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(
          tx
            .select({ one: sql`1` })
            .from(storeChange)
            .where(pending)
            .limit(SNAPSHOT_THRESHOLD + 1)
            .as("pending"),
        );
        if (count > SNAPSHOT_THRESHOLD) return { snapshot: true, head: String(head) };
      }
      const changes = rows.slice(0, limit).map((change) => ({
        seq: String(change.seq),
        id: change.id,
        entity: change.entity,
        entityId: change.entityId,
        op: change.op,
        v: change.v,
        payload: change.payload,
      }));
      return {
        changes,
        cursor: (hasMore && changes.at(-1)?.seq) || String(head),
        head: String(head),
        hasMore,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
