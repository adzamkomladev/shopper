import * as v from "valibot";
import { count, eq } from "drizzle-orm";
import { localSale, productLookup, refund, type TillDatabase } from "@shopper/db-sqlite";
import { add, money, sub, toDecimal, type Money } from "@shopper/money";
import { formatQuantity, toCsv } from "@shopper/utils";
import { refundEvent } from "../schemas/till/refund";
import { saleSnapshot } from "../schemas/till/sale";
import {
  registerReportInput,
  registerReportSchema,
  type RegisterReport,
} from "../schemas/till/report";

const DAY = 86_400_000;

/** The report of completed sales between two UTC days, inclusive (Accra is UTC all year). */
export async function registerReport(db: TillDatabase, raw: unknown): Promise<RegisterReport> {
  const input = v.parse(registerReportInput, raw);
  const start = Date.parse(`${input.from}T00:00:00.000Z`);
  const end = Date.parse(`${input.to}T00:00:00.000Z`) + DAY;
  const { rows, refunds, products } = await db.read(async (tx) => ({
    // ponytail: parses every stored sale; add an indexed day column if a till holds years of sales
    rows: await tx
      .select({ payload: localSale.payload })
      .from(localSale)
      .where(eq(localSale.status, "completed")),
    refunds: await tx.select({ payload: refund.payload }).from(refund),
    products: (await tx.select({ n: count() }).from(productLookup))[0]?.n ?? 0,
  }));
  const tenders = new Map<string, Money>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, amount: money(0), count: 0 }));
  const top = new Map<
    string,
    { productId: string; name: string; quantityThousandths: number; amount: Money }
  >();
  let totals = {
    sales: money(0),
    transactions: 0,
    tax: money(0),
    discounts: money(0),
    net: money(0),
  };
  let discountedSales = 0;
  // Each customer's first sale on this register, so one in the range with an earlier sale is returning.
  const firstSale = new Map<string, number>();
  const buyers = new Set<string>();
  for (const row of rows) {
    const sale = v.parse(saleSnapshot, row.payload);
    const at = Date.parse(sale.deviceTime) - sale.clockOffsetMs;
    if (sale.customer)
      firstSale.set(sale.customer.id, Math.min(at, firstSale.get(sale.customer.id) ?? at));
    if (at < start || at >= end) continue;
    if (sale.customer) buyers.add(sale.customer.id);
    const tax = [sale.totals.vat, sale.totals.nhil, sale.totals.getfund, sale.totals.covid].reduce(
      add,
      money(0),
    );
    const discount = sale.lines.reduce((sum, l) => add(sum, l.discount), money(0));
    totals = {
      sales: add(totals.sales, sale.total),
      transactions: totals.transactions + 1,
      tax: add(totals.tax, tax),
      discounts: add(totals.discounts, discount),
      net: add(totals.net, sub(sale.total, tax)),
    };
    if (discount > 0) discountedSales += 1;
    const hour = hours[new Date(at).getUTCHours()]!;
    hour.amount = add(hour.amount, sale.total);
    hour.count += 1;
    for (const t of sale.tenders) {
      const kept = t.kind === "cash" ? sub(t.amount, sale.change) : t.amount;
      tenders.set(t.kind, add(tenders.get(t.kind) ?? money(0), kept));
    }
    for (const line of sale.lines) {
      const prev = top.get(line.productId);
      top.set(line.productId, {
        productId: line.productId,
        name: line.name,
        quantityThousandths: (prev?.quantityThousandths ?? 0) + line.tax.quantityThousandths,
        amount: add(prev?.amount ?? money(0), line.tax.gross),
      });
    }
  }
  let returns = { count: 0, amount: money(0) };
  for (const row of refunds) {
    const made = v.parse(refundEvent, row.payload).refund;
    const at = Date.parse(made.deviceTime) - made.clockOffsetMs;
    if (at >= start && at < end)
      returns = { count: returns.count + 1, amount: add(returns.amount, made.total) };
  }
  return v.parse(registerReportSchema, {
    from: input.from,
    to: input.to,
    totals,
    tenders: [...tenders]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    byHour: hours,
    topProducts: [...top.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    returns,
    products,
    discountedSales,
    customers: buyers.size,
    returningCustomers: [...buyers].filter((id) => firstSale.get(id)! < start).length,
  });
}

/** The report as CSV: totals, tenders, then top products, money in cedis to 2 dp. */
export function registerReportCsv(report: RegisterReport): string {
  const cedis = (n: number) => toDecimal(money(n));
  const { totals } = report;
  return toCsv([
    ["Register report", `${report.from} to ${report.to}`],
    ["Total sales", cedis(totals.sales)],
    ["Transactions", String(totals.transactions)],
    ["Tax", cedis(totals.tax)],
    ["Discounts", cedis(totals.discounts)],
    ["Net sales", cedis(totals.net)],
    [],
    ["Tender", "Amount"],
    ...report.tenders.map((t) => [t.method, cedis(t.amount)]),
    [],
    ["Product", "Quantity", "Amount"],
    ...report.topProducts.map((p) => [
      p.name,
      formatQuantity(p.quantityThousandths, "-"),
      cedis(p.amount),
    ]),
  ]);
}
