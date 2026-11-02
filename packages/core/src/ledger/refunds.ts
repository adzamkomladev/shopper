import { and, eq, lt } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { loyaltyEntry, type ShopperTransaction } from "@shopper/db-pg";
import { add, lineTotal, mulRatio, sub, type Money } from "@shopper/money";
import type { RefundSnapshot } from "../schemas/till/refund";
import { lastCosts } from "../stock/valuation";
import { tenderAccounts } from "./accounts";
import { negate, postEntry } from "./post";
import type { Posting } from "./types";

/**
 * Posts an accepted refund: sales returns ex-tax and each levy back; the payout through its tender (rounding apart),
 * the account share and the redeemed points' value back to the customer, and anything a clamped split kept to
 * over/short; restocked goods back into inventory at their last received cost; and the earn it took back.
 */
export async function postRefund(
  tx: ShopperTransaction,
  ctx: CommandContext,
  refund: RefundSnapshot,
  share: { account: Money; pointsValue: Money },
  input: { saleId: string; occurredAt: Date },
) {
  const totals = refund.totals;
  const levies = [totals.vat, totals.nhil, totals.getfund, totals.covid].reduce(add);
  // A split clamped against what was left holds back what the till stated; the shop keeps it until reviewed.
  const kept = sub(
    add(refund.accountCredit, refund.pointsValue),
    add(share.account, share.pointsValue),
  );
  return postEntry(tx, ctx, {
    source: "refund",
    sourceId: refund.id,
    occurredAt: input.occurredAt,
    branchId: refund.branchId,
    memo: `Refund ${refund.creditNoteNumber ?? refund.id}`,
    lines: [
      { account: "sales_returns", amount: sub(totals.gross, levies) },
      { account: "vat", amount: totals.vat },
      { account: "nhil", amount: totals.nhil },
      { account: "getfund", amount: totals.getfund },
      { account: "covid", amount: totals.covid },
      { account: "rounding", amount: refund.cashRounding },
      { account: tenderAccounts[refund.tender.kind], amount: negate(refund.total) },
      { account: "receivables", amount: negate(share.account) },
      { account: "loyalty", amount: negate(share.pointsValue) },
      { account: "over_short", amount: negate(kept) },
      ...(await restocked(tx, ctx.orgId, refund)),
      ...(await earnReversed(tx, ctx.orgId, refund.id, input.saleId)),
    ],
  });
}

async function restocked(tx: ShopperTransaction, orgId: string, refund: RefundSnapshot) {
  const costs = await lastCosts(
    tx,
    orgId,
    refund.branchId,
    refund.lines.map((line) => line.productId),
  );
  return refund.lines.flatMap((line): Posting[] => {
    const unitCost = costs.get(line.productId);
    if (unitCost === undefined) return [];
    const cost = lineTotal(unitCost, line.tax.quantityThousandths);
    return [
      { account: "inventory", amount: cost },
      { account: "cogs", amount: negate(cost) },
    ];
  });
}

/** The points the refund took back from the sale's earn, at the value they were earned at. */
async function earnReversed(
  tx: ShopperTransaction,
  orgId: string,
  refundId: string,
  saleId: string,
) {
  const [earn] = await tx
    .select({ value: loyaltyEntry.pointValue })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.orgId, orgId),
        eq(loyaltyEntry.saleId, saleId),
        eq(loyaltyEntry.reason, "earn"),
      ),
    );
  if (!earn?.value) return [];
  const rows = await tx
    .select({ points: loyaltyEntry.points })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.orgId, orgId),
        eq(loyaltyEntry.refundId, refundId),
        eq(loyaltyEntry.reason, "reverse"),
        lt(loyaltyEntry.points, 0),
      ),
    );
  const value = mulRatio(earn.value, -rows.reduce((sum, row) => sum + row.points, 0), 1);
  return [
    { account: "loyalty", amount: value },
    { account: "rewards", amount: negate(value) },
  ] satisfies Posting[];
}
