import * as v from "valibot";

const int = v.pipe(v.number(), v.safeInteger());
const accountType = v.picklist(["asset", "liability", "equity", "income", "expense"]);
const source = v.picklist([
  "sale",
  "refund",
  "credit",
  "loyalty",
  "shift",
  "stock",
  "settlement",
  "manual",
  "reversal",
]);
export type AccountType = v.InferOutput<typeof accountType>;
export type JournalSource = v.InferOutput<typeof source>;

const account = {
  id: v.string(),
  code: v.string(),
  name: v.string(),
  type: accountType,
  systemKey: v.nullable(v.string()),
};
export const accountView = v.object({ ...account, archived: v.boolean() });
export type AccountView = v.InferOutput<typeof accountView>;

export const chartView = v.object({
  lockedThrough: v.nullable(v.string()),
  accounts: v.array(v.object({ ...account, archived: v.boolean(), balance: int })),
});
export type ChartRow = v.InferOutput<typeof chartView>["accounts"][number];

export const accountLinesView = v.object({
  account: accountView,
  opening: int,
  closing: int,
  lines: v.array(
    v.object({
      entryId: v.string(),
      postedOn: v.string(),
      source,
      sourceId: v.string(),
      memo: v.string(),
      amount: int,
      balance: int,
    }),
  ),
});
export type AccountLine = v.InferOutput<typeof accountLinesView>["lines"][number];

export const journalView = v.object({
  entries: v.array(
    v.object({
      id: v.string(),
      postedOn: v.string(),
      source,
      sourceId: v.string(),
      memo: v.string(),
      reversesId: v.nullable(v.string()),
      reversedBy: v.nullable(v.string()),
      lines: v.array(
        v.object({ accountId: v.string(), code: v.string(), name: v.string(), amount: int }),
      ),
    }),
  ),
});
export type JournalEntryView = v.InferOutput<typeof journalView>["entries"][number];

const statementAccount = {
  accountId: v.string(),
  code: v.string(),
  name: v.string(),
  type: accountType,
  systemKey: v.nullable(v.string()),
};
const amountRow = v.object({ ...statementAccount, amount: int });
export type AmountRow = v.InferOutput<typeof amountRow>;

export const trialView = v.object({
  asOf: v.string(),
  rows: v.array(v.object({ ...statementAccount, debit: int, credit: int })),
  totals: v.object({ debit: int, credit: int }),
});
export type TrialView = v.InferOutput<typeof trialView>;

export const profitView = v.object({
  income: v.array(amountRow),
  expenses: v.array(amountRow),
  totals: v.object({ income: int, expenses: int, net: int }),
});
export type ProfitView = v.InferOutput<typeof profitView>;

export const balanceView = v.object({
  assets: v.array(amountRow),
  liabilities: v.array(amountRow),
  equity: v.array(amountRow),
  earnings: int,
  totals: v.object({ assets: int, liabilitiesAndEquity: int }),
});
export type BalanceView = v.InferOutput<typeof balanceView>;

export const postedView = v.object({ id: v.string() });
export const lockView = v.object({ through: v.nullable(v.string()) });

/** The ledger area's search: a range of shop dates (statements use `to` as their "as of" day). */
export const ledgerSearch = v.object({
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  to: v.optional(v.pipe(v.string(), v.isoDate())),
  statement: v.optional(v.picklist(["trial", "profit", "balance"])),
});
export type LedgerSearch = v.InferOutput<typeof ledgerSearch>;
export type Statement = NonNullable<LedgerSearch["statement"]>;
