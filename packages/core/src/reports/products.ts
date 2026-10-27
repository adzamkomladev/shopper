import { sql } from "drizzle-orm";
import * as v from "valibot";
import { add, money, sub, type Money } from "@shopper/money";
import type { ShopperDatabase } from "@shopper/db-pg";
import { reportQuery } from "../schemas/reports/query";
import { inSnapshot, reportSource } from "./read";
import { amount, count, grouped, productsOf, reportRange, shareBps, sums } from "./sums";

const metrics = [
  "quantity",
  "gross",
  "discount",
  "tax",
  "net",
  "cost",
  "uncosted",
  "refund_quantity",
  "refund_gross",
  "refund_net",
  "refund_cost",
];

/**
 * Product performance over a range, best selling (by net revenue) first. Revenue is ex-tax and net of refunds;
 * margin is that revenue less the cost of what stayed sold. A product with uncosted quantity has a margin that
 * leaves those units' cost out, and says so (`costed`: all, some or none).
 */
export async function productReport(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  scope?: string[],
) {
  const query = v.parse(reportQuery, raw);
  const range = reportRange(orgId, query, scope);
  return inSnapshot(db, async (tx) => {
    const rows = await grouped(
      tx,
      sql`product_id::text AS key, ${sums(metrics)}`,
      await reportSource(tx, "products", range),
      sql`GROUP BY 1`,
    );
    const names = await productsOf(
      tx,
      orgId,
      rows.map((row) => row.key!),
    );
    const lines = rows
      .map((row) => {
        const revenue = sub(amount(row.net), amount(row.refund_net));
        const cost = sub(amount(row.cost), amount(row.refund_cost));
        const quantity = count(row.quantity);
        // Sold and refunded units with no cost to them.
        const uncosted = count(row.uncosted);
        const moved = quantity + count(row.refund_quantity);
        return {
          productId: row.key!,
          sku: names.get(row.key!)?.sku ?? "",
          name: names.get(row.key!)?.name ?? row.key!,
          quantity,
          refundQuantity: count(row.refund_quantity),
          gross: amount(row.gross),
          refundGross: amount(row.refund_gross),
          discount: amount(row.discount),
          revenue,
          cost,
          margin: sub(revenue, cost),
          marginBps: shareBps(sub(revenue, cost), revenue),
          costed: uncosted === 0 ? "all" : uncosted < moved ? "some" : "none",
        } as const;
      })
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
    const total = (pick: (line: (typeof lines)[number]) => Money) =>
      lines.reduce((sum, line) => add(sum, pick(line)), money(0));
    const revenue = total((line) => line.revenue);
    const margin = total((line) => line.margin);
    return {
      rows: lines,
      total: {
        gross: total((line) => line.gross),
        refundGross: total((line) => line.refundGross),
        revenue,
        cost: total((line) => line.cost),
        margin,
        marginBps: shareBps(margin, revenue),
        uncosted: lines.filter((line) => line.costed !== "all").length,
      },
    };
  });
}
