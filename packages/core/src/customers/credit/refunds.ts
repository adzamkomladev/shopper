import { and, eq, sql } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { creditEntry, refund, type ShopperTransaction } from "@shopper/db-pg";
import { fromBigInt, money, sub, type Money } from "@shopper/money";

/**
 * How much of a refund goes back to the customer's account: all of it, up to what the sale charged to the account
 * and earlier refunds have not yet credited. Only the rest is paid out in the refund tender.
 */
export const accountShare = (gross: Money, charged: Money, credited: Money) =>
  money(Math.max(0, Math.min(gross, sub(charged, credited))));

/** The part of a refund paid out in its tender, read back from a refund event: total less its rounding. */
export const paidOut = (snapshot: { total: Money; cashRounding: Money }) =>
  sub(snapshot.total, snapshot.cashRounding);

/** What the sale charged to an account (and to whom), and what its accepted refunds already credited back. */
export async function saleAccount(tx: ShopperTransaction, orgId: string, saleId: string) {
  const [charge] = await tx
    .select({ customerId: creditEntry.customerId, amount: creditEntry.amount })
    .from(creditEntry)
    .where(
      and(
        eq(creditEntry.orgId, orgId),
        eq(creditEntry.saleId, saleId),
        eq(creditEntry.kind, "charge"),
      ),
    );
  const [prior] = await tx
    .select({ credited: sql<string>`COALESCE(SUM(${refund.accountCredit}), 0)::text` })
    .from(refund)
    .where(and(eq(refund.orgId, orgId), eq(refund.originalSaleId, saleId)));
  return {
    customerId: charge?.customerId ?? null,
    charged: charge?.amount ?? money(0),
    credited: fromBigInt(BigInt(prior?.credited ?? "0")),
  };
}

/** Writes the credit note that returns a refund's account share; nothing when the share is zero. */
export async function creditRefund(
  tx: ShopperTransaction,
  ctx: CommandContext,
  input: {
    customerId: string | null;
    share: Money;
    refundId: string;
    reason: string;
    actorId: string;
    occurredAt: Date;
  },
) {
  if (input.share === 0 || !input.customerId) return;
  await tx.insert(creditEntry).values({
    orgId: ctx.orgId,
    customerId: input.customerId,
    kind: "credit_note",
    amount: sub(money(0), input.share),
    refundId: input.refundId,
    reason: input.reason,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
  });
}
