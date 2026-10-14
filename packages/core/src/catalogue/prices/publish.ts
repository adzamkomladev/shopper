import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { price, type ShopperTransaction } from "@shopper/db-pg";
import { affectedStores, deleted, recordChanges } from "../../changes";
import { allocateStoreSequence } from "../../sequence";
import { managementJson } from "../../management";
import { priceView } from "./commands";

/**
 * One price.changed envelope per affected store. Starting a window writes no feed row (the price
 * row already arrived with its validFrom) but still takes a fresh sequence, so replay never
 * overwrites an earlier envelope; ending it deletes the price from every till. Realtime delivery is
 * a separate step after this commit.
 */
export const publishPrice = defineCommand({
  name: "price.publish",
  async run(tx, context, input: { priceId: string; phase: "start" | "end" }) {
    const [row] = await tx
      .select()
      .from(price)
      .where(and(eq(price.orgId, context.orgId), eq(price.id, input.priceId)));
    if (!row) return { missing: true, envelopes: [] };
    const storeIds = await affectedStores(tx, context.orgId, row.branchId);
    const heads =
      input.phase === "end"
        ? await recordChanges(tx, context.orgId, [deleted("price", row.id)], storeIds)
        : await startSequences(tx, context.orgId, storeIds);
    const view = priceView(row);
    const envelopes = storeIds.map((storeId) => ({
      storeId,
      envelope: {
        id: v7(),
        orgId: context.orgId,
        v: 1,
        sequence: heads.get(storeId)!.toString(),
        type: "price.changed",
        // Listed field by field: a new price column must not reach devices by accident (the reason stays in the back office).
        payload: {
          priceId: view.id,
          productId: row.productId,
          phase: input.phase,
          id: view.id,
          branchId: view.branchId,
          amount: view.amount,
          validFrom: view.validFrom,
          validTo: view.validTo,
        },
      },
    }));
    return managementJson({ missing: false, envelopes });
  },
  audit: (input, result) => ({
    priceId: input.priceId,
    phase: input.phase,
    stores: result.envelopes.length,
  }),
  details: (input, result) => ({
    entity: "price",
    entityId: input.priceId,
    after: { phase: input.phase, stores: result.envelopes.map((sent) => sent.storeId) },
  }),
});

// Sorted, one at a time: the same store lock order as recordChanges.
async function startSequences(tx: ShopperTransaction, orgId: string, storeIds: string[]) {
  const heads = new Map<string, bigint>();
  for (const id of [...storeIds].sort()) heads.set(id, await allocateStoreSequence(tx, orgId, id));
  return heads;
}
