import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { orderRefund, paymentEvent } from "@shopper/db-pg";

type RefundHook = {
  key: string;
  kind: "refund.processed" | "refund.failed";
  reference: string;
  /** How Paystack names this refund (its id, its refund reference): matched to the refund we asked for. */
  providerIds: string[];
};

/**
 * A Paystack `refund.*` webhook for an online order's payment (its transaction reference is the payment id): records
 * the outcome once. A replay, or a webhook for a refund that is not ours, changes nothing and answers false.
 */
export const applyOrderRefundEvent = defineCommand({
  name: "order.refund.webhook",
  async replay(tx, ctx, input: RefundHook) {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, ctx.orgId),
          eq(paymentEvent.provider, "paystack"),
          eq(paymentEvent.key, input.key),
        ),
      );
    return seen ? { output: false } : undefined;
  },
  async run(tx, ctx, input: RefundHook) {
    await tx.insert(paymentEvent).values({
      orgId: ctx.orgId,
      provider: "paystack",
      key: input.key,
      reference: input.reference,
      kind: input.kind,
    });
    // A payment can have several refunds (a short pick, then a cancel): the one this webhook is about is the one whose
    // provider reference it names; with only one open there is nothing to mistake it for.
    const open = await tx
      .select({ id: orderRefund.id, providerReference: orderRefund.providerReference })
      .from(orderRefund)
      .where(
        and(
          eq(orderRefund.orgId, ctx.orgId),
          eq(orderRefund.orderPaymentId, input.reference),
          eq(orderRefund.status, "requested"),
        ),
      );
    const target =
      open.find(
        (row) => row.providerReference && input.providerIds.includes(row.providerReference),
      ) ?? (open.length === 1 ? open[0] : undefined);
    if (!target) return false;
    await tx
      .update(orderRefund)
      .set({
        status: input.kind === "refund.processed" ? "processed" : "failed",
        failureReason:
          input.kind === "refund.failed" ? "Paystack could not complete this refund." : null,
        updatedAt: new Date(),
      })
      .where(and(eq(orderRefund.orgId, ctx.orgId), eq(orderRefund.id, target.id)));
    return true;
  },
  audit: (input, applied) => ({ reference: input.reference, kind: input.kind, applied }),
});
