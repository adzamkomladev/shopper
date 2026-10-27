import { sql } from "drizzle-orm";
import * as v from "valibot";
import { add, money, sub, type Money } from "@shopper/money";
import type { ShopperDatabase } from "@shopper/db-pg";
import { reportQuery } from "../schemas/reports/query";
import { inSnapshot, reportSource } from "./read";
import { amount, grouped, namesOf, reportRange, sums, tenderLabels } from "./sums";

const figures = [
  "gross",
  "tax",
  "vat",
  "nhil",
  "getfund",
  "covid",
  "rounding",
  "refund_gross",
  "refund_tax",
  "refund_vat",
  "refund_nhil",
  "refund_getfund",
  "refund_covid",
  "refund_rounding",
];
const levies = [
  ["VAT", "vat"],
  ["NHIL", "nhil"],
  ["GETFund levy", "getfund"],
  ["COVID-19 levy", "covid"],
] as const;

/**
 * The accountant's journal: one balanced entry per Accra day and branch. Debits are what each tender took net of
 * what it paid back (cash net of change) and sales returns ex-tax; credits are sales ex-tax and each levy net of
 * what refunds gave back. Cash rounding is a credit when customers paid more than the goods and a debit when less.
 */
export async function journalReport(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  scope?: string[],
) {
  const query = v.parse(reportQuery, raw);
  const range = reportRange(orgId, query, scope);
  return inSnapshot(db, async (tx) => {
    const days = await grouped(
      tx,
      sql`day::text AS day, branch_id::text AS branch_id, ${sums(figures)}`,
      await reportSource(tx, "sales", range),
      sql`GROUP BY day, branch_id ORDER BY day, branch_id`,
    );
    const tenders = await grouped(
      tx,
      sql`day::text AS day, branch_id::text AS branch_id, kind, ${sums(["amount", "refunded"])}`,
      await reportSource(tx, "tenders", range),
      sql`GROUP BY day, branch_id, kind`,
    );
    const names = await namesOf(tx, orgId, "branch", [...new Set(days.map((d) => d.branch_id!))]);
    const rows = days.flatMap((entry) => {
      const taken = (kind: string) =>
        tenders.find(
          (t) => t.day === entry.day && t.branch_id === entry.branch_id && t.kind === kind,
        );
      const net = (column: string) => sub(amount(entry[column]), amount(entry[`refund_${column}`]));
      return [
        ...Object.keys(tenderLabels).map((kind) =>
          posting(
            tenderLabels[kind]!,
            sub(amount(taken(kind)?.refunded), amount(taken(kind)?.amount)),
          ),
        ),
        posting("Sales", sub(amount(entry.gross), amount(entry.tax))),
        posting("Sales returns", sub(amount(entry.refund_tax), amount(entry.refund_gross))),
        ...levies.map(([account, column]) => posting(account, net(column))),
        posting("Cash rounding", net("rounding")),
      ]
        .filter((line) => line.debit !== 0 || line.credit !== 0)
        .map((line) => ({
          day: entry.day!,
          branchId: entry.branch_id!,
          branch: names.get(entry.branch_id!) ?? entry.branch_id!,
          ...line,
        }));
    });
    return {
      rows,
      total: {
        debit: rows.reduce((sum, row) => add(sum, row.debit), money(0)),
        credit: rows.reduce((sum, row) => add(sum, row.credit), money(0)),
      },
    };
  });
}

/** A journal line from its credit balance: a negative credit is posted as a debit. */
const posting = (account: string, credit: Money) =>
  credit < 0
    ? { account, debit: sub(money(0), credit), credit: money(0) }
    : { account, debit: money(0), credit };
