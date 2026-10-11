import { defineCommand, type CommandContext } from "@shopper/audit";
import { store, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { and, eq, sql } from "drizzle-orm";

const allocateSequence = defineCommand({
  name: "store.sequence",
  run: (tx, context, input: { storeId: string; floor: bigint }) =>
    allocateStoreSequence(tx, context.orgId, input.storeId, input.floor),
  audit: (input, output) => ({ storeId: input.storeId, sequence: output.toString() }),
  details: (input, output) => ({
    entity: "store",
    entityId: input.storeId,
    after: { lastSeq: output.toString() },
  }),
});
// The engines coordinate; this audited PG transaction remains the authoritative cursor.
export function nextStoreSequence(
  db: ShopperDatabase,
  context: CommandContext,
  storeId: string,
  floor = 0n,
) {
  return allocateSequence(db, context, { storeId, floor });
}
// Inside a command's transaction: bump and return the store's sequence.
export async function allocateStoreSequence(
  tx: ShopperTransaction,
  orgId: string,
  storeId: string,
  floor = 0n,
) {
  if (floor < 0n || floor >= 9223372036854775807n) throw new RangeError("Invalid sequence floor");
  const [row] = await tx
    .update(store)
    .set({ lastSeq: sql`greatest(${store.lastSeq}, ${floor.toString()}::bigint) + 1` })
    .where(and(eq(store.orgId, orgId), eq(store.id, storeId)))
    .returning({ seq: store.lastSeq });
  if (!row) throw new Error("Store does not belong to this organization");
  return row.seq;
}
