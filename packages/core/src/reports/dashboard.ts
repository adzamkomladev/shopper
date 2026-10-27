import { sql } from "drizzle-orm";
import * as v from "valibot";
import { money, sub } from "@shopper/money";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";
import { dashboardQuery } from "../schemas/reports/query";
import { inSnapshot, reportSource } from "./read";
import { amount, changeBps, count, grouped, perSale, productsOf, reportRange, sums } from "./sums";
import type { ReportRange } from "./types";

const TOP = 5;
const empty = {
  transactions: 0,
  items: 0,
  gross: money(0),
  refundGross: money(0),
  netSales: money(0),
};

/**
 * The dashboard for one Accra day against the day before: net sales, transactions, average basket, items per
 * basket, refunds and margin, then the day's top products, tender mix and sales by hour (both days).
 */
export async function dashboard(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  scope?: string[],
  today = new Date().toISOString().slice(0, 10),
) {
  const query = v.parse(dashboardQuery, raw);
  const day = query.day ?? today;
  const yesterday = new Date(Date.parse(`${day}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const both = reportRange(orgId, { from: yesterday, to: day, branchId: query.branchId }, scope);
  const one = { ...both, from: day };
  return inSnapshot(db, async (tx) => {
    const sales = await perDay(tx, both);
    const margins = await marginPerDay(tx, both);
    const of = (d: string) => ({
      ...(sales.get(d) ?? empty),
      margin: margins.get(d) ?? money(0),
    });
    const now = of(day);
    const before = of(yesterday);
    const kpi = (pick: (figures: typeof now) => number) => ({
      value: pick(now),
      yesterday: pick(before),
      changeBps: changeBps(money(pick(now)), money(pick(before))),
    });
    return {
      day,
      yesterday,
      kpis: {
        netSales: kpi((f) => f.netSales),
        transactions: kpi((f) => f.transactions),
        basket: kpi((f) => perSale(f.gross, f.transactions)),
        // Thousandths of a unit, like every quantity.
        itemsPerBasket: kpi((f) => (f.transactions ? Math.round(f.items / f.transactions) : 0)),
        refunds: kpi((f) => f.refundGross),
        margin: kpi((f) => f.margin),
      },
      top: await topProducts(tx, one),
      tenders: await tenderMix(tx, one),
      hours: await hours(tx, both, day, yesterday),
    };
  });
}

async function perDay(tx: ShopperTransaction, range: ReportRange) {
  const rows = await grouped(
    tx,
    sql`day::text AS key, ${sums(["sales", "items", "gross", "refund_gross"])}`,
    await reportSource(tx, "sales", range),
    sql`GROUP BY 1`,
  );
  return new Map(
    rows.map((row) => [
      row.key!,
      {
        transactions: count(row.sales),
        items: count(row.items),
        gross: amount(row.gross),
        refundGross: amount(row.refund_gross),
        netSales: sub(amount(row.gross), amount(row.refund_gross)),
      },
    ]),
  );
}

async function marginPerDay(tx: ShopperTransaction, range: ReportRange) {
  const rows = await grouped(
    tx,
    sql`day::text AS key, coalesce(sum(net - refund_net - cost + refund_cost), 0)::text AS margin`,
    await reportSource(tx, "products", range),
    sql`GROUP BY 1`,
  );
  return new Map(rows.map((row) => [row.key!, amount(row.margin)]));
}

async function topProducts(tx: ShopperTransaction, range: ReportRange) {
  const rows = await grouped(
    tx,
    sql`product_id::text AS key, coalesce(sum(gross - refund_gross), 0)::text AS sales,
      coalesce(sum(quantity - refund_quantity), 0)::text AS quantity`,
    await reportSource(tx, "products", range),
    sql`GROUP BY 1 ORDER BY sum(gross - refund_gross) DESC, 1 LIMIT ${TOP}`,
  );
  const names = await productsOf(
    tx,
    range.orgId,
    rows.map((row) => row.key!),
  );
  return rows.map((row) => ({
    productId: row.key!,
    name: names.get(row.key!)?.name ?? row.key!,
    netSales: amount(row.sales),
    quantity: count(row.quantity),
  }));
}

async function tenderMix(tx: ShopperTransaction, range: ReportRange) {
  const rows = await grouped(
    tx,
    sql`kind AS key, ${sums(["count", "amount", "refunded"])}`,
    await reportSource(tx, "tenders", range),
    sql`GROUP BY 1 ORDER BY sum(amount) DESC, 1`,
  );
  return rows.map((row) => ({
    kind: row.key!,
    transactions: count(row.count),
    net: sub(amount(row.amount), amount(row.refunded)),
  }));
}

async function hours(tx: ShopperTransaction, range: ReportRange, day: string, yesterday: string) {
  const rows = await grouped(
    tx,
    sql`day::text AS day, hour::text AS hour, coalesce(sum(gross - refund_gross), 0)::text AS sales`,
    await reportSource(tx, "sales", range),
    sql`GROUP BY 1, 2`,
  );
  const at = (d: string, hour: number) =>
    amount(rows.find((row) => row.day === d && Number(row.hour) === hour)?.sales);
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    today: at(day, hour),
    yesterday: at(yesterday, hour),
  }));
}
