import * as v from "valibot";
import { and, eq, inArray, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { onlineOrder, stockMovement, type ShopperTransaction } from "@shopper/db-pg";
import { recordFiscalDoc } from "../../../fiscal/documents";
import { reverseOrder } from "../../../ledger/orders";
import { receiptDocument } from "../../../schemas/receipts/document";
import { recordStatus } from "../../fulfil/events";
import type { CompensationReason } from "../../types";
import { readGoods } from "../../fulfil/adjust";
import { documentOf, goodsOf } from "../../fulfil/goods";
import { owe } from "../apply";
import { keeperPayment } from "../keeper";

type Order = typeof onlineOrder.$inferSelect;
type Status = Order["status"];

/** Why a paid order is given back, and the statuses it can still be in when that happens. */
const reasons = {
  not_accepted: ["paid"],
  declined: ["paid"],
  cancelled: ["paid", "accepted", "picking", "ready", "out_for_delivery"],
  not_fulfilled: ["accepted", "picking"],
  uncollected: ["ready", "out_for_delivery"],
} satisfies Record<CompensationReason, Status[]>;

/**
 * Compensates a paid order the shop will not fill: the order is refunded, the goods go back on the shelf, the books
 * and the invoice are reversed (a credit note for the fiscal lane), and the payer's money is queued to go back.
 * Answers false when the order was no longer paid (a replayed step).
 */
export const refundPaidOrder = defineCommand({
  name: "order.refund",
  async run(tx, ctx, input: { id: string; reason: CompensationReason; now?: Date }) {
    const now = input.now ?? new Date();
    const [order] = await tx
      .update(onlineOrder)
      .set({ status: "refunded", updatedAt: now })
      .where(
        and(
          eq(onlineOrder.orgId, ctx.orgId),
          eq(onlineOrder.id, input.id),
          inArray(onlineOrder.status, reasons[input.reason]),
        ),
      )
      .returning();
    if (!order) return { refunded: false as const, id: null };
    await recordStatus(tx, ctx, order.id, "refunded", now);
    const payment = await keeperPayment(tx, ctx.orgId, order.id);
    const refund = (await owe(tx, ctx, payment, input.reason))!;
    await giveBack(tx, ctx, order, refund.id, now);
    return { refunded: true as const, id: refund.id };
  },
  audit: (input, output) => ({ id: input.id, reason: input.reason, refunded: output.refunded }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

async function giveBack(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  refundId: string,
  now: Date,
) {
  // Whatever of the order is still out of the shelf goes back: the sale less anything already returned.
  const out = await tx
    .select({
      productId: stockMovement.productId,
      quantity: sql<number>`sum(${stockMovement.quantityThousandths})`.mapWith(Number),
    })
    .from(stockMovement)
    .where(and(eq(stockMovement.orgId, ctx.orgId), eq(stockMovement.orderId, order.id)))
    .groupBy(stockMovement.productId);
  const owed = out.filter((row) => row.quantity < 0);
  if (owed.length)
    await tx.insert(stockMovement).values(
      owed.map((row) => ({
        orgId: ctx.orgId,
        branchId: order.branchId,
        productId: row.productId,
        orderId: order.id,
        reason: "return" as const,
        quantityThousandths: -row.quantity,
        occurredAt: now,
      })),
    );
  await reverseOrder(tx, ctx, order, refundId, now);
  // The credit note covers what the shopper finally held: the order as picked, not as first ordered.
  const { lines, picks } = await readGoods(tx, ctx.orgId, order.id, true);
  const goods = goodsOf(lines, picks);
  const receipt = v.parse(receiptDocument, order.receipt);
  await recordFiscalDoc(
    tx,
    ctx.orgId,
    documentOf(receipt, [...goods.kept, ...goods.substitutes], {
      kind: "refund",
      number: `${receipt.header.receiptNumber}-C`,
      at: now,
    }),
    { storeId: order.storeId, branchId: order.branchId, orderRefundId: refundId },
  );
}
