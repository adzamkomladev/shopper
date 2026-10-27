import { sql } from "drizzle-orm";
import * as v from "valibot";
import { add, money, sub, type Money } from "@shopper/money";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";
import { salesQuery } from "../schemas/reports/query";
import { datesBetween } from "./days";
import { inSnapshot, reportSource } from "./read";
import { amount, count, grouped, namesOf, perSale, reportRange, shareBps, sums } from "./sums";
import type { ReportRange } from "./types";

const metrics = ["sales", "items", "gross", "discount", "tax", "net", "refunds", "refund_gross"];
const keys = { day: sql`day`, hour: sql`hour`, branch: sql`branch_id`, cashier: sql`cashier_id` };
const tenderLabels: Record<string, string> = {
  cash: "Cash",
  momo: "MoMo",
  card: "Card",
  credit: "Customer credit",
  loyalty: "Loyalty points",
};

/**
 * Sales by day (every day of the range, empty ones included), Accra hour, branch, cashier or tender, with a total.
 * Net sales are the gross taken less the gross refunded; a tender's net is what it took less what it paid back.
 */
export async function salesReport(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  scope?: string[],
) {
  const query = v.parse(salesQuery, raw);
  const range = reportRange(orgId, query, scope);
  return inSnapshot(db, async (tx) =>
    query.by === "tender"
      ? { by: query.by, ...(await byTender(tx, range)) }
      : { by: query.by, ...(await bySales(tx, range, query.by)) },
  );
}

async function bySales(
  tx: ShopperTransaction,
  range: ReportRange,
  by: "day" | "hour" | "branch" | "cashier",
) {
  const rows = await grouped(
    tx,
    sql`${keys[by]}::text AS key, ${sums(metrics)}`,
    await reportSource(tx, "sales", range),
    sql`GROUP BY ${keys[by]} ORDER BY ${keys[by]}`,
  );
  const names =
    by === "branch" || by === "cashier"
      ? await namesOf(
          tx,
          range.orgId,
          by,
          rows.map((row) => row.key!),
        )
      : new Map<string, string>();
  const read = rows.map((row) => salesRow(row.key!, label(by, row.key!, names), row));
  const filled =
    by === "day"
      ? datesBetween(range.from, range.to).map(
          (day) => read.find((row) => row.key === day) ?? salesRow(day, day, {}),
        )
      : read;
  return { rows: filled, total: salesRow("total", "Total", totalOf(rows)) };
}

function salesRow(key: string, label: string, row: Record<string, string | undefined>) {
  const gross = amount(row.gross);
  const refundGross = amount(row.refund_gross);
  const transactions = count(row.sales);
  return {
    key,
    label,
    transactions,
    items: count(row.items),
    gross,
    discount: amount(row.discount),
    tax: amount(row.tax),
    net: amount(row.net),
    refunds: count(row.refunds),
    refundGross,
    netSales: sub(gross, refundGross),
    basket: perSale(gross, transactions),
  };
}

const totalOf = (rows: Record<string, string>[]) =>
  Object.fromEntries(
    metrics.map((metric) => [
      metric,
      String(rows.reduce((sum, row) => sum + BigInt(row[metric] ?? 0), 0n)),
    ]),
  );

function label(by: string, key: string, names: Map<string, string>) {
  if (by === "hour") return `${key.padStart(2, "0")}:00`;
  return names.get(key) ?? key;
}

async function byTender(tx: ShopperTransaction, range: ReportRange) {
  const rows = await grouped(
    tx,
    sql`kind AS key, ${sums(["count", "amount", "refunded"])}`,
    await reportSource(tx, "tenders", range),
    sql`GROUP BY 1 ORDER BY 1`,
  );
  // A split sale counts once in the total, as it does in every other grouping.
  const [sales] = await grouped(tx, sums(["sales"]), await reportSource(tx, "sales", range));
  const taken = rows.reduce((sum, row) => add(sum, amount(row.amount)), money(0));
  const refunded = rows.reduce((sum, row) => add(sum, amount(row.refunded)), money(0));
  const tenderRow = (key: string, label: string, sales: number, took: Money, back: Money) => ({
    key,
    label,
    transactions: sales,
    amount: took,
    refunded: back,
    net: sub(took, back),
    shareBps: shareBps(took, taken),
  });
  return {
    rows: rows.map((row) =>
      tenderRow(
        row.key!,
        tenderLabels[row.key!] ?? row.key!,
        count(row.count),
        amount(row.amount),
        amount(row.refunded),
      ),
    ),
    total: tenderRow("total", "Total", count(sales?.sales), taken, refunded),
  };
}
