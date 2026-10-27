import { sql } from "drizzle-orm";
import * as v from "valibot";
import { add, money, sub } from "@shopper/money";
import type { ShopperDatabase } from "@shopper/db-pg";
import { reportQuery } from "../schemas/reports/query";
import { inSnapshot, reportSource } from "./read";
import { amount, count, grouped, namesOf, perSale, reportRange, shareBps, sums } from "./sums";

/** Branches side by side over a range: sales, basket, refunds, margin and each one's share of net sales. */
export async function branchComparison(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  scope?: string[],
) {
  const query = v.parse(reportQuery, raw);
  const range = reportRange(orgId, query, scope);
  return inSnapshot(db, async (tx) => {
    const sales = await grouped(
      tx,
      sql`branch_id::text AS key, ${sums(["sales", "items", "gross", "refunds", "refund_gross"])}`,
      await reportSource(tx, "sales", range),
      sql`GROUP BY 1`,
    );
    const margins = new Map(
      (
        await grouped(
          tx,
          sql`branch_id::text AS key, coalesce(sum(net - refund_net - cost + refund_cost), 0)::text AS margin`,
          await reportSource(tx, "products", range),
          sql`GROUP BY 1`,
        )
      ).map((row) => [row.key!, amount(row.margin)]),
    );
    const names = await namesOf(
      tx,
      orgId,
      "branch",
      sales.map((row) => row.key!),
    );
    const lines = sales.map((row) => {
      const transactions = count(row.sales);
      const gross = amount(row.gross);
      return {
        branchId: row.key!,
        name: names.get(row.key!) ?? row.key!,
        transactions,
        gross,
        refunds: count(row.refunds),
        refundGross: amount(row.refund_gross),
        netSales: sub(gross, amount(row.refund_gross)),
        basket: perSale(gross, transactions),
        margin: margins.get(row.key!) ?? money(0),
      };
    });
    const whole = lines.reduce((sum, line) => add(sum, line.netSales), money(0));
    const gross = lines.reduce((sum, line) => add(sum, line.gross), money(0));
    const transactions = lines.reduce((sum, line) => sum + line.transactions, 0);
    return {
      rows: lines
        .map((line) => ({ ...line, shareBps: shareBps(line.netSales, whole) }))
        .sort((a, b) => b.netSales - a.netSales || a.name.localeCompare(b.name)),
      total: {
        transactions,
        gross,
        refunds: lines.reduce((sum, line) => sum + line.refunds, 0),
        refundGross: lines.reduce((sum, line) => add(sum, line.refundGross), money(0)),
        netSales: whole,
        basket: perSale(gross, transactions),
        margin: lines.reduce((sum, line) => add(sum, line.margin), money(0)),
        shareBps: whole === 0 ? 0 : 10_000,
      },
    };
  });
}
