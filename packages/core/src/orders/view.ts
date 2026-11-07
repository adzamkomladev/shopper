import { and, asc, desc, eq } from "drizzle-orm";
import {
  branch,
  onlineOrder,
  onlineOrderAdjustment,
  onlineOrderEvent,
  onlineOrderLine,
  onlineOrderPick,
  orderPayment,
  orderReview,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import type { Queryable } from "../types";
import { reviewable } from "./reviews/submit";

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
  const picks = await db
    .select()
    .from(onlineOrderPick)
    .where(and(eq(onlineOrderPick.orgId, orgId), eq(onlineOrderPick.orderId, row.id)));
  const [adjustment] = await db
    .select()
    .from(onlineOrderAdjustment)
    .where(and(eq(onlineOrderAdjustment.orgId, orgId), eq(onlineOrderAdjustment.orderId, row.id)));
  const [review] = await db
    .select({
      rating: orderReview.rating,
      comment: orderReview.comment,
      status: orderReview.status,
    })
    .from(orderReview)
    .where(and(eq(orderReview.orgId, orgId), eq(orderReview.orderId, row.id)));
  const timeline = await db
    .select({ status: onlineOrderEvent.status, at: onlineOrderEvent.at })
    .from(onlineOrderEvent)
    .where(and(eq(onlineOrderEvent.orgId, orgId), eq(onlineOrderEvent.orderId, row.id)))
    .orderBy(asc(onlineOrderEvent.at));
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
    timeline: timeline.map((event) => ({ status: event.status, at: event.at.toISOString() })),
    /** The shopper's own review of the order, whatever its state; null until they give one. */
    review: review ?? null,
    canReview: row.status === "completed" && !review && reviewable(row.completedAt),
    /** What picking changed, once it did: shown to the shopper only after the pick is finished. */
    adjustment: adjustment
      ? {
          beforeGross: adjustment.beforeGross,
          afterGross: adjustment.afterGross,
          refundAmount: adjustment.refundAmount,
        }
      : null,
    totals: {
      base: row.base,
      vat: row.vat,
      nhil: row.nhil,
      getfund: row.getfund,
      covid: row.covid,
      gross: row.gross,
    },
    lines: lines.map((line) => ({
      id: line.id,
      pick: adjustment ? pickOf(picks.find((pick) => pick.lineId === line.id)) : null,
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

/** What picking found for a line, as the shopper is told: the quantity they get and any substitute. */
function pickOf(pick: typeof onlineOrderPick.$inferSelect | undefined) {
  if (!pick) return null;
  return {
    outcome: pick.outcome,
    pickedThousandths: pick.pickedThousandths,
    substitute: pick.substituteProductId
      ? {
          name: (pick.substitutePayload as { name: string }).name,
          quantityThousandths: pick.substituteQuantityThousandths!,
          gross: pick.substituteGross!,
        }
      : null,
  };
}
