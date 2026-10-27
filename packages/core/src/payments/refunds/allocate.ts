import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import {
  payment,
  paymentRefund,
  saleTender,
  workflowRun,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money, roundCash, sub, type Money } from "@shopper/money";

/**
 * The compensation of a MoMo refund: sends `total`, rounded to whole pesewas, back to the sale's confirmed MoMo
 * payments in tender order, never more than each still holds. Paystack payments go to the refund workflow
 * after commit; Hubtel ones are marked `manual`, refunded from the Hubtel dashboard.
 */
export async function allocateMomoRefund(
  tx: ShopperTransaction,
  context: CommandContext,
  input: { refundId: string; saleId: string; total: Money },
) {
  const paid = await tx
    .select({ id: payment.id, amount: payment.amount, provider: payment.provider })
    .from(saleTender)
    .innerJoin(
      payment,
      and(eq(payment.orgId, saleTender.orgId), eq(payment.id, saleTender.paymentId)),
    )
    .where(
      and(
        eq(saleTender.orgId, context.orgId),
        eq(saleTender.saleId, input.saleId),
        isNotNull(saleTender.paymentId),
        eq(payment.status, "confirmed"),
      ),
    )
    .orderBy(asc(saleTender.position));
  if (paid.length === 0) return [];
  const prior = await tx
    .select({
      paymentId: paymentRefund.paymentId,
      amount: sql<string>`sum(${paymentRefund.amount})`,
    })
    .from(paymentRefund)
    .where(
      and(
        eq(paymentRefund.orgId, context.orgId),
        inArray(
          paymentRefund.paymentId,
          paid.map((row) => row.id),
        ),
        sql`${paymentRefund.status} <> 'failed'`,
      ),
    )
    .groupBy(paymentRefund.paymentId);
  let left = roundCash(input.total, 100);
  const rows = paid.flatMap((row) => {
    const refunded = money(Number(prior.find((p) => p.paymentId === row.id)?.amount ?? 0));
    const room = sub(row.amount, refunded);
    const amount = left < room ? left : room;
    if (amount <= 0) return [];
    left = sub(left, amount);
    return [{ id: v7(), paymentId: row.id, amount, manual: row.provider === "hubtel" }];
  });
  if (rows.length === 0) return [];
  await tx.insert(paymentRefund).values(
    rows.map((row) => ({
      id: row.id,
      orgId: context.orgId,
      paymentId: row.paymentId,
      refundId: input.refundId,
      amount: row.amount,
      status: row.manual ? ("manual" as const) : ("pending" as const),
      failureReason: row.manual ? "Refund this payment from the Hubtel dashboard" : null,
    })),
  );
  for (const row of rows.filter((entry) => !entry.manual)) {
    await tx.insert(workflowRun).values({
      orgId: context.orgId,
      instanceId: row.id,
      businessKey: row.id,
      type: "momo-refund",
      currentStep: "created",
      status: "waiting",
    });
    // Not store-sequenced: the consumer starts the workflow, which reads the row.
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: context.orgId,
      v: 1,
      sequence: "0",
      type: "payment.refund",
      payload: { id: row.id },
    });
  }
  return rows;
}
