import { and, asc, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  onlineOrderAdjustment,
  onlineOrderLine,
  onlineOrderPick,
  stockMovement,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { sub } from "@shopper/money";
import { recordFiscalDoc } from "../../fiscal/documents";
import { postOrderAdjustment } from "../../ledger/orders";
import { receiptDocument } from "../../schemas/receipts/document";
import * as v from "valibot";
import { checkStockAlerts } from "../../stock/reorder";
import { owe } from "../payments/apply";
import { keeperPayment } from "../payments/keeper";
import { documentOf, goodsOf, totalOf } from "./goods";

type Order = typeof onlineOrder.$inferSelect;

/**
 * The lines and picks of an order, the two things its goods are worked out from. With `applied`, picks count only
 * once an adjustment has made them real: a pick still being recorded changes nothing yet.
 */
export async function readGoods(
  tx: ShopperTransaction,
  orgId: string,
  orderId: string,
  applied = false,
) {
  const lines = await tx
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, orgId), eq(onlineOrderLine.orderId, orderId)))
    .orderBy(asc(onlineOrderLine.position));
  const picks = await tx
    .select()
    .from(onlineOrderPick)
    .where(and(eq(onlineOrderPick.orgId, orgId), eq(onlineOrderPick.orderId, orderId)));
  if (!applied) return { lines, picks };
  const [adjustment] = await tx
    .select({ id: onlineOrderAdjustment.id })
    .from(onlineOrderAdjustment)
    .where(and(eq(onlineOrderAdjustment.orgId, orgId), eq(onlineOrderAdjustment.orderId, orderId)));
  return { lines, picks: adjustment ? picks : [] };
}

/**
 * Finishing a pick that changed the order, in the finishing transaction: the missing goods go back on the shelf and
 * the substitutes leave it, the payer is owed the difference, a credit note (and an invoice for the substitutes) is
 * made for the fiscal lane, and the books move by the same amounts. Answers null when the order was picked in full.
 */
export async function settleAdjustment(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  now: Date,
) {
  const { lines, picks } = await readGoods(tx, ctx.orgId, order.id);
  const goods = goodsOf(lines, picks);
  if (!goods.credits.length) return null;
  const credited = totalOf(goods.credits);
  const charged = totalOf(goods.substitutes);
  const payment = await keeperPayment(tx, ctx.orgId, order.id);
  const refund = await owe(tx, ctx, payment, "short_pick", sub(credited.gross, charged.gross));
  const receipt = v.parse(receiptDocument, order.receipt);
  const number = receipt.header.receiptNumber!;
  const [adjustment] = await tx
    .insert(onlineOrderAdjustment)
    .values({
      orgId: ctx.orgId,
      orderId: order.id,
      beforeGross: order.gross,
      afterGross: sub(order.gross, sub(credited.gross, charged.gross)),
      refundAmount: sub(credited.gross, charged.gross),
      refundId: refund?.id ?? null,
      creditNoteNumber: `${number}-A`,
      supplementNumber: goods.substitutes.length ? `${number}-S` : null,
    })
    .returning();
  const source = { storeId: order.storeId, branchId: order.branchId };
  await recordFiscalDoc(
    tx,
    ctx.orgId,
    documentOf(receipt, goods.credits, { kind: "refund", number: `${number}-A`, at: now }),
    { ...source, adjustmentCreditId: adjustment!.id },
  );
  if (goods.substitutes.length)
    await recordFiscalDoc(
      tx,
      ctx.orgId,
      documentOf(receipt, goods.substitutes, { kind: "sale", number: `${number}-S`, at: now }),
      { ...source, adjustmentInvoiceId: adjustment!.id },
    );
  await tx.insert(stockMovement).values([
    ...goods.returned.map((item) => ({
      orgId: ctx.orgId,
      branchId: order.branchId,
      productId: item.productId,
      orderId: order.id,
      reason: "return" as const,
      quantityThousandths: item.quantityThousandths,
      occurredAt: now,
    })),
    ...goods.replaced.map((item) => ({
      orgId: ctx.orgId,
      branchId: order.branchId,
      productId: item.productId,
      orderId: order.id,
      reason: "sale" as const,
      quantityThousandths: -item.quantityThousandths,
      occurredAt: now,
    })),
  ]);
  await checkStockAlerts(
    tx,
    ctx,
    order.branchId,
    goods.replaced.map((item) => item.productId),
  );
  await postOrderAdjustment(
    tx,
    ctx,
    order,
    adjustment!.id,
    {
      method: payment.method,
      credited,
      charged,
      returned: goods.returned,
      replaced: goods.replaced,
    },
    now,
  );
  await tx
    .update(onlineOrder)
    .set({ fulfilledGross: adjustment!.afterGross, updatedAt: now })
    .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
  return { id: adjustment!.id, refundAmount: adjustment!.refundAmount };
}

/** Whether anything is left to hand over once picking is done: goods or substitutes, not just the delivery fee. */
export const hasGoods = (goods: ReturnType<typeof goodsOf>) =>
  [...goods.kept, ...goods.substitutes].some((item) => item.productId);
