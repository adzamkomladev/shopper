import { and, asc, eq } from "drizzle-orm";
import { enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  onlineOrderLine,
  stockMovement,
  type orderPayment,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { v7 } from "uuid";
import { recordFiscalDoc } from "../../fiscal/documents";
import { postOrder } from "../../ledger/orders";
import { checkStockAlerts } from "../../stock/reorder";
import { recordStatus } from "../fulfil/events";
import { releaseOrderHolds } from "../holds";
import { buildOrderReceipt } from "../receipt";

type Order = typeof onlineOrder.$inferSelect;
type Payment = typeof orderPayment.$inferSelect;

/**
 * The payment that keeps an order, in the transaction that confirmed it: the order is paid and invoiced (its
 * receipt, a pending fiscal document), the goods leave the shelf and the held stock is given up, the money is posted
 * to the books, and the confirmation is queued once the transaction commits.
 */
export async function settleOrder(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  payment: Payment,
  now: Date,
) {
  const lines = await tx
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, ctx.orgId), eq(onlineOrderLine.orderId, order.id)))
    .orderBy(asc(onlineOrderLine.position));
  const { number, receipt } = await buildOrderReceipt(
    tx,
    order,
    lines,
    payment,
    now,
    ctx.appVersion,
  );
  const [paid] = await tx
    .update(onlineOrder)
    .set({ status: "paid", paidAt: now, receiptNumber: number, receipt, updatedAt: now })
    .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)))
    .returning();
  await recordStatus(tx, ctx, order.id, "paid", now);
  await recordFiscalDoc(tx, ctx.orgId, receipt, {
    storeId: order.storeId,
    branchId: order.branchId,
    orderId: order.id,
  });
  const goods = lines.flatMap((line) =>
    line.productId ? [{ ...line, productId: line.productId }] : [],
  );
  await tx.insert(stockMovement).values(
    goods.map((line) => ({
      orgId: ctx.orgId,
      branchId: order.branchId,
      productId: line.productId,
      orderId: order.id,
      reason: "sale" as const,
      quantityThousandths: -line.quantityThousandths,
      occurredAt: now,
    })),
  );
  await releaseOrderHolds(tx, ctx.orgId, order.id, "fulfilled", now);
  await checkStockAlerts(
    tx,
    ctx,
    order.branchId,
    goods.map((line) => line.productId),
  );
  await postOrder(tx, ctx, paid!, lines, payment.method, now);
  enqueueAfterCommit(tx, {
    id: v7(),
    orgId: ctx.orgId,
    v: 1,
    sequence: "0",
    type: "order.confirmation",
    payload: { orderId: order.id },
  });
}
