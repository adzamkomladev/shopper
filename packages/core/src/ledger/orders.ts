import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  journalEntry,
  journalLine,
  type onlineOrder,
  type onlineOrderLine,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, lineTotal, sub } from "@shopper/money";
import type { SaleSnapshot } from "../schemas/till/sale";
import { lastCosts } from "../stock/valuation";
import { negate, postEntry } from "./post";
import type { Posting } from "./types";

type Order = typeof onlineOrder.$inferSelect;
type Line = typeof onlineOrderLine.$inferSelect;

/**
 * Posts a paid online order: what the card or mobile money took in, sales ex-tax and each levy as the order
 * snapshotted it, and the cost of its goods at their last received cost.
 */
export async function postOrder(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  lines: Line[],
  method: "card" | "momo",
  occurredAt: Date,
) {
  const levies = [order.vat, order.nhil, order.getfund, order.covid].reduce(add);
  return postEntry(tx, ctx, {
    source: "order",
    sourceId: order.id,
    occurredAt,
    branchId: order.branchId,
    memo: `Online order ${order.receiptNumber ?? order.inboxCursor}`,
    lines: [
      { account: method === "card" ? "card_clearing" : "momo_clearing", amount: order.gross },
      { account: "sales", amount: negate(sub(order.gross, levies)) },
      { account: "vat", amount: negate(order.vat) },
      { account: "nhil", amount: negate(order.nhil) },
      { account: "getfund", amount: negate(order.getfund) },
      { account: "covid", amount: negate(order.covid) },
      ...(await costOfGoods(tx, order, lines)),
    ],
  });
}

async function costOfGoods(tx: ShopperTransaction, order: Order, lines: Line[]) {
  const products = lines.flatMap((line) =>
    line.productId ? [{ ...line, productId: line.productId }] : [],
  );
  const costs = await lastCosts(
    tx,
    order.orgId,
    order.branchId,
    products.map((line) => line.productId),
  );
  return products.flatMap((line): Posting[] => {
    const unitCost = costs.get(line.productId);
    if (unitCost === undefined) return [];
    const tax = (line.payload as { tax: SaleSnapshot["lines"][number]["tax"] }).tax;
    const cost = lineTotal(unitCost, tax.quantityThousandths);
    return [
      { account: "cogs", amount: cost },
      { account: "inventory", amount: negate(cost) },
    ];
  });
}

/** Gives a paid order's books back exactly: the original entry's lines, each on the other side. */
export async function reverseOrder(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  refundId: string,
  occurredAt: Date,
) {
  const [entry] = await tx
    .select()
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.orgId, ctx.orgId),
        eq(journalEntry.source, "order"),
        eq(journalEntry.sourceId, order.id),
      ),
    );
  if (!entry) return null;
  const original = await tx
    .select()
    .from(journalLine)
    .where(and(eq(journalLine.orgId, ctx.orgId), eq(journalLine.entryId, entry.id)));
  return postEntry(tx, ctx, {
    source: "reversal",
    sourceId: refundId,
    occurredAt,
    branchId: order.branchId,
    memo: `Refund of online order ${order.receiptNumber ?? order.inboxCursor}`,
    reversesId: entry.id,
    lines: original.map((line) => ({
      account: { id: line.accountId },
      amount: negate(line.amount),
      memo: line.memo ?? undefined,
    })),
  });
}
