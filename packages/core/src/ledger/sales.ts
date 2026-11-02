import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { loyaltyEntry, type ShopperTransaction } from "@shopper/db-pg";
import { add, lineTotal, mulRatio, sub } from "@shopper/money";
import type { SaleSnapshot } from "../schemas/till/sale";
import { lastCosts } from "../stock/valuation";
import { negate, postEntry } from "./post";
import { tenderAccounts } from "./accounts";
import type { Posting } from "./types";

/**
 * Posts an accepted sale: what each tender took (cash net of change), sales ex-tax, each levy as the till snapshotted
 * it and cash rounding; the cost of its goods at their last received cost; and the value of the points it earned.
 */
export async function postSale(
  tx: ShopperTransaction,
  ctx: CommandContext,
  sale: SaleSnapshot,
  occurredAt: Date,
) {
  const totals = sale.totals;
  const levies = [totals.vat, totals.nhil, totals.getfund, totals.covid].reduce(add);
  return postEntry(tx, ctx, {
    source: "sale",
    sourceId: sale.id,
    occurredAt,
    branchId: sale.branchId,
    memo: `Sale ${sale.receiptNumber ?? sale.localId}`,
    lines: [
      ...sale.tenders.map((tender) => ({
        account: tenderAccounts[tender.kind],
        amount: tender.amount,
      })),
      { account: "cash_drawer", amount: negate(sale.change) },
      { account: "sales", amount: negate(sub(totals.gross, levies)) },
      { account: "vat", amount: negate(totals.vat) },
      { account: "nhil", amount: negate(totals.nhil) },
      { account: "getfund", amount: negate(totals.getfund) },
      { account: "covid", amount: negate(totals.covid) },
      { account: "rounding", amount: negate(sale.cashRounding) },
      ...(await costOfGoods(tx, ctx.orgId, sale)),
      ...(await pointsEarned(tx, ctx.orgId, sale.id)),
    ],
  });
}

/** Inventory out and cost of goods in, for the lines whose product has a costed receipt at the branch. */
async function costOfGoods(tx: ShopperTransaction, orgId: string, sale: SaleSnapshot) {
  const costs = await lastCosts(
    tx,
    orgId,
    sale.branchId,
    sale.lines.map((line) => line.productId),
  );
  return sale.lines.flatMap((line): Posting[] => {
    const unitCost = costs.get(line.productId);
    if (unitCost === undefined) return [];
    const cost = lineTotal(unitCost, line.tax.quantityThousandths);
    return [
      { account: "cogs", amount: cost },
      { account: "inventory", amount: negate(cost) },
    ];
  });
}

/** The liability for the points the sale earned, at the point value they were earned at. */
async function pointsEarned(tx: ShopperTransaction, orgId: string, saleId: string) {
  const [earn] = await tx
    .select({ points: loyaltyEntry.points, value: loyaltyEntry.pointValue })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.orgId, orgId),
        eq(loyaltyEntry.saleId, saleId),
        eq(loyaltyEntry.reason, "earn"),
      ),
    );
  if (!earn?.value) return [];
  const value = mulRatio(earn.value, earn.points, 1);
  return [
    { account: "rewards", amount: value },
    { account: "loyalty", amount: negate(value) },
  ] satisfies Posting[];
}
