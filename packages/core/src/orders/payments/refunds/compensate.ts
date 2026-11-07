import * as v from "valibot";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  onlineOrderLine,
  orderPayment,
  orderRefund,
  stockMovement,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { recordFiscalDoc } from "../../../fiscal/documents";
import { reverseOrder } from "../../../ledger/orders";
import { accraClock } from "../../../receipts/build";
import { receiptDocument } from "../../../schemas/receipts/document";
import { recordStatus } from "../../fulfil/events";
import type { CompensationReason } from "../../types";
import { owe } from "../apply";

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
    // The payment that kept the order: confirmed, and not already owed back (a duplicate payment is).
    const [payment] = await tx
      .select({ payment: orderPayment })
      .from(orderPayment)
      .leftJoin(
        orderRefund,
        and(
          eq(orderRefund.orgId, orderPayment.orgId),
          eq(orderRefund.orderPaymentId, orderPayment.id),
          inArray(orderRefund.reason, ["late_payment", "duplicate_payment"]),
        ),
      )
      .where(
        and(
          eq(orderPayment.orgId, ctx.orgId),
          eq(orderPayment.orderId, order.id),
          eq(orderPayment.status, "confirmed"),
          isNull(orderRefund.id),
        ),
      )
      .orderBy(asc(orderPayment.confirmedAt))
      .limit(1);
    const refund = (await owe(tx, ctx, payment!.payment, input.reason))!;
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
  const lines = await tx
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, ctx.orgId), eq(onlineOrderLine.orderId, order.id)))
    .orderBy(asc(onlineOrderLine.position));
  const goods = lines.flatMap((line) =>
    line.productId ? [{ ...line, productId: line.productId }] : [],
  );
  await tx.insert(stockMovement).values(
    goods.map((line) => ({
      orgId: ctx.orgId,
      branchId: order.branchId,
      productId: line.productId,
      orderId: order.id,
      reason: "return" as const,
      quantityThousandths: line.quantityThousandths,
      occurredAt: now,
    })),
  );
  await reverseOrder(tx, ctx, order, refundId, now);
  const receipt = v.parse(receiptDocument, order.receipt);
  await recordFiscalDoc(
    tx,
    ctx.orgId,
    {
      ...receipt,
      kind: "refund",
      refundOf: receipt.header.receiptNumber,
      header: {
        ...receipt.header,
        receiptNumber: `${receipt.header.receiptNumber}-C`,
        utcTime: now.toISOString(),
        accraTime: accraClock(now),
      },
      paid: money(0),
      change: money(0),
      fiscal: null,
    },
    { storeId: order.storeId, branchId: order.branchId, orderRefundId: refundId },
  );
}
