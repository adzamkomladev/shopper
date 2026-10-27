import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { paymentRefund, type paymentRefundStatuses, type ShopperTransaction } from "@shopper/db-pg";
import type { WorkflowCheckpoint } from "@shopper/ports";

type Change = {
  id: string;
  status: (typeof paymentRefundStatuses)[number];
  providerReference?: string;
  reason?: string;
};

/** Records a refund's provider outcome; a pending refund may carry a reason, such as an unconfirmed one. */
export const updatePaymentRefund = defineCommand({
  name: "payment.refund.updated",
  run: changeRefund,
  audit: (input, output) => ({ id: input.id, status: output.status }),
});

export async function changeRefund(tx: ShopperTransaction, context: CommandContext, input: Change) {
  const where = and(eq(paymentRefund.orgId, context.orgId), eq(paymentRefund.id, input.id));
  const [current] = await tx.select().from(paymentRefund).where(where);
  if (!current) throw new Error("Payment refund not found");
  // Only an authoritative success can follow a failure; processed and manual refunds are final.
  const open =
    current.status === "pending" || (current.status === "failed" && input.status === "processed");
  const [row] = open
    ? await tx
        .update(paymentRefund)
        .set({
          status: input.status,
          providerReference: input.providerReference ?? current.providerReference,
          failureReason: input.status === "processed" ? null : (input.reason ?? null),
          updatedAt: new Date(),
        })
        .where(where)
        .returning()
    : [current];
  return refundView(row!);
}

export const refundView = (row: typeof paymentRefund.$inferSelect) => ({
  id: row.id,
  paymentId: row.paymentId,
  refundId: row.refundId,
  amount: row.amount,
  status: row.status,
  providerReference: row.providerReference,
  failureReason: row.failureReason,
});

export const refundCheckpoint = (
  id: string,
  step: string,
  status: WorkflowCheckpoint["status"],
): WorkflowCheckpoint => ({ instanceId: id, businessKey: id, type: "momo-refund", step, status });
