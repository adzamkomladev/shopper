import type { CommandContext } from "@shopper/audit";
import { and, eq } from "drizzle-orm";
import { loyaltyEntry, type creditEntry, type ShopperTransaction } from "@shopper/db-pg";
import { mulRatio } from "@shopper/money";
import { tenderAccounts } from "./accounts";
import { negate, postEntry } from "./post";

type CreditRow = Pick<
  typeof creditEntry.$inferSelect,
  "id" | "kind" | "amount" | "method" | "occurredAt" | "refundId"
>;

/**
 * Posts what a customer-account entry changes in the books. A charge is already in its sale (the credit tender), a
 * refund's credit note in its refund, and a transfer moves a balance between customers inside the same control
 * account, so those post nothing here.
 */
export async function postCredit(tx: ShopperTransaction, ctx: CommandContext, row: CreditRow) {
  const lines = creditLines(row);
  if (!lines) return null;
  return postEntry(tx, ctx, {
    source: "credit",
    sourceId: row.id,
    occurredAt: row.occurredAt,
    memo: memos[row.kind as keyof typeof memos],
    lines,
  });
}

const memos = {
  payment: "Payment on account",
  credit_note: "Credit note",
  interest: "Interest on account",
};

function creditLines(row: CreditRow) {
  if (row.kind === "payment")
    return [
      { account: tenderAccounts[row.method!], amount: negate(row.amount) },
      { account: "receivables" as const, amount: row.amount },
    ];
  if (row.kind === "credit_note" && !row.refundId)
    return [
      { account: "sales_returns" as const, amount: negate(row.amount) },
      { account: "receivables" as const, amount: row.amount },
    ];
  if (row.kind === "interest")
    return [
      { account: "receivables" as const, amount: row.amount },
      { account: "interest" as const, amount: negate(row.amount) },
    ];
  return null;
}

/** Posts lapsed points: the liability falls by what the lot was worth when earned, and so do the rewards. */
export async function postExpiry(
  tx: ShopperTransaction,
  ctx: CommandContext,
  row: { id: string; points: number; lotId: string; occurredAt: Date },
) {
  const [lot] = await tx
    .select({ value: loyaltyEntry.pointValue })
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.orgId, ctx.orgId), eq(loyaltyEntry.id, row.lotId)));
  if (!lot?.value) return null;
  const value = mulRatio(lot.value, -row.points, 1);
  return postEntry(tx, ctx, {
    source: "loyalty",
    sourceId: row.id,
    occurredAt: row.occurredAt,
    memo: "Points expired",
    lines: [
      { account: "loyalty", amount: value },
      { account: "rewards", amount: negate(value) },
    ],
  });
}
