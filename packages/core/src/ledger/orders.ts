import { and, eq, inArray, sql } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  journalEntry,
  journalLine,
  onlineOrderAdjustment,
  type onlineOrder,
  type onlineOrderLine,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, lineTotal, money, sub, type Money } from "@shopper/money";
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

/**
 * Posts what picking changed in a paid order, as one balanced entry: the clearing account gives back the refund, the
 * sales and each levy fall by what was credited less what the substitutes charge, and the cost of goods follows the
 * stock (back for what was missing, out for the substitutes).
 */
export async function postOrderAdjustment(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  adjustmentId: string,
  input: {
    method: "card" | "momo";
    credited: Total;
    charged: Total;
    returned: Stock[];
    replaced: Stock[];
  },
  occurredAt: Date,
) {
  const less = (key: keyof Total) => sub(input.credited[key], input.charged[key]);
  const levies = [less("vat"), less("nhil"), less("getfund"), less("covid")].reduce(add);
  // What comes back reverses the cost the sale booked (as of payment); a substitute goes out at today's cost.
  const worth = async (items: Stock[], asOf?: Date) => {
    const costs = await lastCosts(
      tx,
      order.orgId,
      order.branchId,
      items.map((item) => item.productId),
      asOf,
    );
    return items
      .map((item) => {
        const unit = costs.get(item.productId);
        return unit === undefined ? money(0) : lineTotal(unit, item.quantityThousandths);
      })
      .reduce(add, money(0));
  };
  const back = await worth(input.returned, order.paidAt ?? occurredAt);
  const out = await worth(input.replaced);
  return postEntry(tx, ctx, {
    source: "order",
    sourceId: adjustmentId,
    occurredAt,
    branchId: order.branchId,
    memo: `Picked online order ${order.receiptNumber ?? order.inboxCursor}`,
    lines: [
      {
        account: input.method === "card" ? "card_clearing" : "momo_clearing",
        amount: negate(less("gross")),
      },
      { account: "sales", amount: sub(less("gross"), levies) },
      { account: "vat", amount: less("vat") },
      { account: "nhil", amount: less("nhil") },
      { account: "getfund", amount: less("getfund") },
      { account: "covid", amount: less("covid") },
      { account: "cogs", amount: sub(out, back) },
      { account: "inventory", amount: sub(back, out) },
    ],
  });
}

type Total = Record<"base" | "vat" | "nhil" | "getfund" | "covid" | "gross", Money>;
type Stock = { productId: string; quantityThousandths: number };

/**
 * Gives a paid order's books back exactly: the original entry's lines, and those of any picking adjustment, summed
 * account by account and each on the other side.
 */
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
  const [adjustment] = await tx
    .select({ id: onlineOrderAdjustment.id })
    .from(onlineOrderAdjustment)
    .where(
      and(eq(onlineOrderAdjustment.orgId, ctx.orgId), eq(onlineOrderAdjustment.orderId, order.id)),
    );
  const original = await tx
    .select({
      accountId: journalLine.accountId,
      amount: sql<number>`sum(${journalLine.amount})`.mapWith(Number),
    })
    .from(journalLine)
    .innerJoin(
      journalEntry,
      and(eq(journalEntry.orgId, journalLine.orgId), eq(journalEntry.id, journalLine.entryId)),
    )
    .where(
      and(
        eq(journalLine.orgId, ctx.orgId),
        eq(journalEntry.source, "order"),
        inArray(journalEntry.sourceId, adjustment ? [order.id, adjustment.id] : [order.id]),
      ),
    )
    .groupBy(journalLine.accountId);
  return postEntry(tx, ctx, {
    source: "reversal",
    sourceId: refundId,
    occurredAt,
    branchId: order.branchId,
    memo: `Refund of online order ${order.receiptNumber ?? order.inboxCursor}`,
    reversesId: entry.id,
    lines: original.map((line) => ({
      account: { id: line.accountId },
      amount: negate(money(line.amount)),
    })),
  });
}
