import { and, eq, sql } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { creditEntry, refund, type ShopperTransaction } from "@shopper/db-pg";
import { currentCustomerId } from "../sale";
import { fromBigInt, money, mulRatio, sub, unitsOf, type Money } from "@shopper/money";

/**
 * How much of a refund goes back to the customer's account: all of it, up to what the sale charged to the account
 * and earlier refunds have not yet credited. Only the rest is paid out in the refund tender.
 */
export const accountShare = (gross: Money, charged: Money, credited: Money) =>
  money(Math.max(0, Math.min(gross, sub(charged, credited))));

type Redeemed = { points: number; value: Money } | null;

/**
 * How a refund of `gross` is paid back: to the account first, then as redeemed points (whole points, up to the points
 * the sale redeemed less those already handed back), and only the rest in the refund's own tender.
 */
export function allocateRefund(
  gross: Money,
  account: { charged: Money; credited: Money },
  points: { redeemed: Redeemed; returned: number },
) {
  const toAccount = accountShare(gross, account.charged, account.credited);
  const { redeemed } = points;
  if (!redeemed) return { account: toAccount, points: 0, pointsValue: money(0) };
  const perPoint = mulRatio(redeemed.value, 1, redeemed.points);
  const back = Math.min(
    redeemed.points - points.returned,
    unitsOf(sub(gross, toAccount), perPoint),
  );
  return { account: toAccount, points: back, pointsValue: mulRatio(perPoint, back, 1) };
}

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

/** Writes the credit note that returns a refund's account share, to the merge winner if the customer was merged away;
 * nothing when the share is zero. */
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
    customerId: await currentCustomerId(tx, ctx.orgId, input.customerId),
    kind: "credit_note",
    amount: sub(money(0), input.share),
    refundId: input.refundId,
    reason: input.reason,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
  });
}
