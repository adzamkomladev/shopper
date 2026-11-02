import * as v from "valibot";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { journalLine, ledgerAccount, type AccountType } from "@shopper/db-pg";
import { add, money, sub, type Money } from "@shopper/money";
import { asOfQuery, rangeQuery } from "../schemas/ledger/inputs";
import type { Queryable } from "../types";
import type { ReportTable } from "../reports/types";
import { negate } from "./post";

/** Every account with posted lines to `asOf`, its balance split into a debit or a credit column. */
export async function trialBalance(db: Queryable, orgId: string, raw: unknown) {
  const query = v.parse(asOfQuery, raw);
  const rows = (await balances(db, orgId, undefined, query.asOf)).map((row) => ({
    ...row,
    debit: row.balance > 0 ? row.balance : money(0),
    credit: row.balance < 0 ? negate(row.balance) : money(0),
  }));
  return {
    asOf: query.asOf,
    rows,
    totals: {
      debit: rows.reduce((sum, row) => add(sum, row.debit), money(0)),
      credit: rows.reduce((sum, row) => add(sum, row.credit), money(0)),
    },
  };
}

/** Income and expenses posted in a range, both as positive amounts, and the net profit (income − expenses). */
export async function profitLoss(db: Queryable, orgId: string, raw: unknown) {
  const query = v.parse(rangeQuery, raw);
  const rows = await balances(db, orgId, query.from, query.to);
  const income = section(rows, "income", -1);
  const expenses = section(rows, "expense", 1);
  const totals = { income: total(income), expenses: total(expenses) };
  return {
    from: query.from,
    to: query.to,
    income,
    expenses,
    totals: { ...totals, net: sub(totals.income, totals.expenses) },
  };
}

/**
 * Assets against liabilities and equity at `asOf`. Income and expenses never close into retained earnings by hand,
 * so their sum to date is shown as current earnings and makes the sides equal.
 */
export async function balanceSheet(db: Queryable, orgId: string, raw: unknown) {
  const query = v.parse(asOfQuery, raw);
  const rows = await balances(db, orgId, undefined, query.asOf);
  const assets = section(rows, "asset", 1);
  const liabilities = section(rows, "liability", -1);
  const equity = section(rows, "equity", -1);
  const earnings = sub(total(section(rows, "income", -1)), total(section(rows, "expense", 1)));
  return {
    asOf: query.asOf,
    assets,
    liabilities,
    equity,
    earnings,
    totals: {
      assets: total(assets),
      liabilitiesAndEquity: add(add(total(liabilities), total(equity)), earnings),
    },
  };
}

/** The statements laid out for CSV download, one row per account and a total row. */
export const statementTables = {
  trial: async (db: Queryable, orgId: string, raw: unknown): Promise<ReportTable> => {
    const tb = await trialBalance(db, orgId, raw);
    return {
      name: `trial-balance-${tb.asOf}`,
      headers: ["Code", "Account", "Type", "Debit", "Credit"],
      rows: [
        ...tb.rows.map((row) => [
          text(row.code),
          text(row.name),
          text(row.type),
          cash(row.debit),
          cash(row.credit),
        ]),
        [text(""), text("Total"), text(""), cash(tb.totals.debit), cash(tb.totals.credit)],
      ],
    };
  },
  profit: async (db: Queryable, orgId: string, raw: unknown): Promise<ReportTable> => {
    const pl = await profitLoss(db, orgId, raw);
    return {
      name: `profit-loss-${pl.from}-${pl.to}`,
      headers: ["Code", "Account", "Type", "Amount"],
      rows: [
        ...[...pl.income, ...pl.expenses].map((row) => [
          text(row.code),
          text(row.name),
          text(row.type),
          cash(row.amount),
        ]),
        [text(""), text("Net profit"), text(""), cash(pl.totals.net)],
      ],
    };
  },
  balance: async (db: Queryable, orgId: string, raw: unknown): Promise<ReportTable> => {
    const bs = await balanceSheet(db, orgId, raw);
    return {
      name: `balance-sheet-${bs.asOf}`,
      headers: ["Code", "Account", "Type", "Amount"],
      rows: [
        ...[...bs.assets, ...bs.liabilities, ...bs.equity].map((row) => [
          text(row.code),
          text(row.name),
          text(row.type),
          cash(row.amount),
        ]),
        [text(""), text("Current earnings"), text("equity"), cash(bs.earnings)],
      ],
    };
  },
};

type Balance = Awaited<ReturnType<typeof balances>>[number];

/** Each account's posted balance (debits +) over a range of posting days; accounts without lines are left out. */
async function balances(db: Queryable, orgId: string, from: string | undefined, to: string) {
  const rows = await db
    .select({
      accountId: ledgerAccount.id,
      code: ledgerAccount.code,
      name: ledgerAccount.name,
      type: ledgerAccount.type,
      systemKey: ledgerAccount.systemKey,
      balance: sql<string>`SUM(${journalLine.amount})::text`,
    })
    .from(journalLine)
    .innerJoin(
      ledgerAccount,
      and(eq(ledgerAccount.orgId, journalLine.orgId), eq(ledgerAccount.id, journalLine.accountId)),
    )
    .where(
      and(
        eq(journalLine.orgId, orgId),
        from ? gte(journalLine.postedOn, from) : undefined,
        lte(journalLine.postedOn, to),
      ),
    )
    .groupBy(ledgerAccount.id)
    .orderBy(asc(ledgerAccount.code));
  return rows.map((row) => ({ ...row, balance: money(Number(row.balance)) }));
}

/** One type's accounts with the balance turned to its natural side (sign −1 shows credits as positive). */
const section = (rows: Balance[], type: AccountType, sign: 1 | -1) =>
  rows
    .filter((row) => row.type === type)
    .map(({ balance, ...row }) => ({ ...row, amount: sign === 1 ? balance : negate(balance) }));

const total = (rows: { amount: Money }[]) =>
  rows.reduce((sum, row) => add(sum, row.amount), money(0));
const text = (value: string) => ({ kind: "text" as const, value });
const cash = (value: Money) => ({ kind: "money" as const, value });
