import { and, asc, desc, eq } from "drizzle-orm";
import { branch, onlineOrder, onlineOrderLine, orderPayment } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import type { Queryable } from "../types";

/**
 * The order as its shopper sees it, found by the checkout key the browser kept. Anyone without the key gets nothing,
 * so an order id alone never reveals a customer's name, phone or address.
 */
export async function readOrderView(db: Queryable, orgId: string, id: string, key: string) {
  const order = await orderByDigest(db, orgId, await sha256(key.toLowerCase()));
  return order?.id === id ? order : undefined;
}

/** The order placed with this key digest, shaped for the confirmation page. */
export async function orderByDigest(db: Queryable, orgId: string, digest: string) {
  const [order] = await db
    .select({ order: onlineOrder, branchName: branch.name })
    .from(onlineOrder)
    .innerJoin(
      branch,
      and(eq(branch.orgId, onlineOrder.orgId), eq(branch.id, onlineOrder.branchId)),
    )
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.viewTokenDigest, digest)));
  if (!order) return undefined;
  const lines = await db
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, orgId), eq(onlineOrderLine.orderId, order.order.id)))
    .orderBy(asc(onlineOrderLine.position));
  const row = order.order;
  const [attempt] = await db
    .select()
    .from(orderPayment)
    .where(and(eq(orderPayment.orgId, orgId), eq(orderPayment.orderId, row.id)))
    .orderBy(desc(orderPayment.createdAt))
    .limit(1);
  return {
    id: row.id,
    number: Number(row.inboxCursor),
    channel: row.channel,
    status: row.status,
    branch: { id: row.branchId, name: order.branchName },
    fulfilment: row.fulfilment,
    slotStart: row.slotStart.toISOString(),
    slotEnd: row.slotEnd.toISOString(),
    deliveryAddress: row.deliveryAddress as Record<string, string> | null,
    customerName: row.customerName,
    holdExpiresAt: row.holdExpiresAt.toISOString(),
    receiptNumber: row.receiptNumber,
    paidAt: row.paidAt?.toISOString() ?? null,
    /** The latest attempt to pay: what the shopper sees while they wait, and why one failed. */
    payment: attempt
      ? {
          id: attempt.id,
          method: attempt.method,
          provider: attempt.provider,
          status: attempt.status,
          checkoutUrl: attempt.status === "pending" ? attempt.checkoutUrl : null,
          failureReason: attempt.failureReason,
        }
      : null,
    placedAt: row.placedAt.toISOString(),
    totals: {
      base: row.base,
      vat: row.vat,
      nhil: row.nhil,
      getfund: row.getfund,
      covid: row.covid,
      gross: row.gross,
    },
    lines: lines.map((line) => ({
      kind: line.kind,
      productId: line.productId,
      priceId: line.priceId,
      quantityThousandths: line.quantityThousandths,
      gross: line.gross,
      name: (line.payload as { name: string }).name,
      baseUnit: (line.payload as { baseUnit?: string }).baseUnit ?? "each",
    })),
  };
}
