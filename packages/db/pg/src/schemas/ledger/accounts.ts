import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tenant } from "../base";

export const accountTypes = ["asset", "liability", "equity", "income", "expense"] as const;
export type AccountType = (typeof accountTypes)[number];

/**
 * The keys of the accounts every org's books start with; migration 0037's org trigger seeds them with their codes and
 * names. Postings name them by key; owners may rename them, never retype or archive them.
 */
export const systemAccountKeys = [
  "cash_drawer",
  "cash_safe",
  "bank",
  "momo_clearing",
  "card_clearing",
  "receivables",
  "inventory",
  "goods_received",
  "vat",
  "nhil",
  "getfund",
  "covid",
  "loyalty",
  "owner_equity",
  "retained_earnings",
  "sales",
  "sales_returns",
  "interest",
  "rounding",
  "over_short",
  "cogs",
  "shrinkage",
  "fees",
  "rewards",
] as const;
export type SystemAccount = (typeof systemAccountKeys)[number];

export const ledgerAccount = pgTable(
  "ledger_account",
  {
    ...tenant(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: accountTypes }).notNull(),
    /** The posting key of a system account; null for an account the owner added. */
    systemKey: text("system_key"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("ledger_account_code").on(t.orgId, t.code),
    unique("ledger_account_system").on(t.orgId, t.systemKey),
    check(
      "ledger_account_type",
      sql`${t.type} IN ('asset', 'liability', 'equity', 'income', 'expense')`,
    ),
    check("ledger_account_code_format", sql`${t.code} ~ '^[0-9]{4,6}$'`),
    check("ledger_account_system_kept", sql`${t.systemKey} IS NULL OR ${t.archivedAt} IS NULL`),
  ],
);
