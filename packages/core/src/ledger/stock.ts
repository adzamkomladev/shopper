import type { CommandContext } from "@shopper/audit";
import { and, eq } from "drizzle-orm";
import { stockMovement, type ShopperTransaction } from "@shopper/db-pg";
import { lineTotal } from "@shopper/money";
import { lastCosts } from "../stock/valuation";
import { negate, postEntry } from "./post";
import type { Posting } from "./types";

/**
 * Posts one stock document from its movements. A costed receipt adds inventory owed to the supplier; an adjustment
 * or count moves inventory at the branch's last received cost against shrinkage (found stock reverses it). An
 * uncosted receipt, or a product never received at a cost, posts nothing: there is no value to book yet.
 */
export async function postStock(
  tx: ShopperTransaction,
  ctx: CommandContext,
  document: { id: string; branchId: string; occurredAt: Date; memo: string },
) {
  const moves = await tx
    .select()
    .from(stockMovement)
    .where(and(eq(stockMovement.orgId, ctx.orgId), eq(stockMovement.documentId, document.id)));
  const costs = await lastCosts(
    tx,
    ctx.orgId,
    document.branchId,
    moves.map((move) => move.productId),
  );
  const lines = moves.flatMap((move): Posting[] => {
    if (move.unitCost !== null) {
      const value = lineTotal(move.unitCost, move.quantityThousandths);
      return [
        { account: "inventory", amount: value },
        { account: "goods_received", amount: negate(value) },
      ];
    }
    const cost = costs.get(move.productId);
    if (move.reason === "receipt" || cost === undefined) return [];
    const value = lineTotal(cost, move.quantityThousandths);
    return [
      { account: "inventory", amount: value },
      { account: "shrinkage", amount: negate(value) },
    ];
  });
  return postEntry(tx, ctx, {
    source: "stock",
    sourceId: document.id,
    occurredAt: document.occurredAt,
    branchId: document.branchId,
    memo: document.memo,
    lines,
  });
}
