import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { money, sub, type Money } from "@shopper/money";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import {
  onlineOrder,
  orderPayment,
  orderRefund,
  paymentEvent,
  stockHold,
  type momoProviders,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { OrderPaymentApplied } from "../types";
import { settleOrder } from "./settle";

type Event = {
  provider: (typeof momoProviders)[number];
  /** The provider's identity for this event: a replay carries the same key. */
  key: string;
  kind: string;
  reference: string;
  status: "confirmed" | "failed";
  providerReference?: string;
  message?: string;
  now?: Date;
};
/**
 * Applies a provider's word on one order payment exactly once. A confirmation in time pays and invoices the order in
 * this same transaction; one that finds the order lapsed, cancelled or already paid owes the payer a refund instead,
 * queued after the commit. A replayed event answers `duplicate` and changes nothing.
 */
export const applyOrderPaymentEvent = defineCommand({
  name: "order.payment.event",
  async replay(tx, context, event: Event): Promise<{ output: OrderPaymentApplied } | undefined> {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, context.orgId),
          eq(paymentEvent.provider, event.provider),
          eq(paymentEvent.key, event.key),
        ),
      );
    return seen ? { output: { duplicate: true } } : undefined;
  },
  async run(tx, context, event: Event): Promise<OrderPaymentApplied> {
    const now = event.now ?? new Date();
    await tx.insert(paymentEvent).values({
      orgId: context.orgId,
      provider: event.provider,
      key: event.key,
      reference: event.reference,
      kind: event.kind,
    });
    const [payment] = await tx
      .select()
      .from(orderPayment)
      .where(and(eq(orderPayment.orgId, context.orgId), eq(orderPayment.id, event.reference)))
      .for("update");
    if (!payment) throw new Error("Order payment not found");
    const open = payment.status === "pending" || payment.status === "otp";
    if (event.status === "failed") {
      if (open)
        await tx
          .update(orderPayment)
          .set({ status: "failed", failureReason: event.message ?? null, updatedAt: now })
          .where(and(eq(orderPayment.orgId, context.orgId), eq(orderPayment.id, payment.id)));
      return { duplicate: false, outcome: "failed", orderId: payment.orderId };
    }
    // A payment already confirmed cannot be confirmed again (a second provider event for the same attempt).
    if (payment.status === "confirmed")
      return { duplicate: false, outcome: "ignored", orderId: payment.orderId };
    const [confirmed] = await tx
      .update(orderPayment)
      .set({
        status: "confirmed",
        confirmedAt: now,
        providerReference: event.providerReference ?? payment.providerReference,
        failureReason: null,
        updatedAt: now,
      })
      .where(and(eq(orderPayment.orgId, context.orgId), eq(orderPayment.id, payment.id)))
      .returning();
    const [order] = await tx
      .select()
      .from(onlineOrder)
      .where(and(eq(onlineOrder.orgId, context.orgId), eq(onlineOrder.id, payment.orderId)))
      .for("update");
    if (order!.status === "placed" && (await stillHeld(tx, context.orgId, order!.id, now))) {
      await settleOrder(tx, context, order!, confirmed!, now);
      return { duplicate: false, outcome: "settled", orderId: order!.id };
    }
    await owe(tx, context, confirmed!, refundReason[order!.status]);
    return { duplicate: false, outcome: "refund", orderId: order!.id };
  },
  audit: (event, output) => ({
    reference: event.reference,
    provider: event.provider,
    kind: event.kind,
    ...(output.duplicate ? {} : { outcome: output.outcome }),
  }),
});

const refundReason = {
  placed: "late_payment",
  expired: "late_payment",
  cancelled: "late_payment",
  refunded: "late_payment",
  paid: "duplicate_payment",
  accepted: "duplicate_payment",
  picking: "duplicate_payment",
  ready: "duplicate_payment",
  out_for_delivery: "duplicate_payment",
  completed: "duplicate_payment",
} as const;

/** Stock is still aside for the order: its hold has neither been released nor run out. */
async function stillHeld(tx: ShopperTransaction, orgId: string, orderId: string, now: Date) {
  const [held] = await tx
    .select({ id: stockHold.id })
    .from(stockHold)
    .where(
      and(
        eq(stockHold.orgId, orgId),
        eq(stockHold.orderId, orderId),
        isNull(stockHold.releasedAt),
        // Past its deadline the stock is already for sale again, whether or not a timer has freed it yet.
        gt(stockHold.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(held);
}

/** Records the money owed back for a payment and queues its refund; one refund per payment, however often asked. */
export async function owe(
  tx: ShopperTransaction,
  context: { orgId: string },
  payment: typeof orderPayment.$inferSelect,
  reason: (typeof orderRefund.$inferInsert)["reason"],
  /** Owed back so far or not, a refund for a part of the payment says how much; otherwise all that is left. */
  part?: Money,
) {
  const [owed] = await tx
    .select({ total: sql<number>`coalesce(sum(${orderRefund.amount}), 0)`.mapWith(Number) })
    .from(orderRefund)
    .where(and(eq(orderRefund.orgId, context.orgId), eq(orderRefund.orderPaymentId, payment.id)));
  const amount = part ?? sub(payment.amount, money(owed!.total));
  if (amount <= 0) return undefined;
  const [created] = await tx
    .insert(orderRefund)
    .values({ orgId: context.orgId, orderPaymentId: payment.id, amount, reason })
    .onConflictDoNothing({
      target: [orderRefund.orgId, orderRefund.orderPaymentId, orderRefund.reason],
    })
    .returning();
  if (created)
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: context.orgId,
      v: 1,
      sequence: "0",
      type: "order.refund",
      payload: { id: created.id },
    });
  return created;
}

/** Nobody paid and the provider says nothing happened: the open attempt lapses. */
export const expireOrderPayment = defineCommand({
  name: "order.payment.expired",
  async run(tx, context, input: { id: string }) {
    const lapsed = await tx
      .update(orderPayment)
      .set({
        status: "expired",
        failureReason: "The payment was not completed in time.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderPayment.orgId, context.orgId),
          eq(orderPayment.id, input.id),
          inArray(orderPayment.status, ["pending", "otp"]),
        ),
      )
      .returning({ id: orderPayment.id });
    return { lapsed: lapsed.length > 0 };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "order_payment", entityId: input.id }),
});
