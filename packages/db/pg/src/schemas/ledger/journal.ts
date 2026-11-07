import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, moneyColumn, tenant } from "../base";
import { user } from "../auth";
import { ledgerAccount } from "./accounts";

export const journalSources = [
  "sale",
  "refund",
  "order",
  "credit",
  "loyalty",
  "shift",
  "stock",
  "settlement",
  "manual",
  "reversal",
] as const;
export type JournalSource = (typeof journalSources)[number];

/**
 * One balanced posting. Append-only: triggers refuse updates and deletes, and a deferred trigger refuses an entry
 * whose lines do not sum to zero at commit. The source key makes posting from a replayed command a no-op.
 */
export const journalEntry = pgTable(
  "journal_entry",
  {
    ...tenant(),
    /** The Accra day the entry counts on: its own day, or the first open day after the lock. */
    postedOn: date("posted_on").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    source: text("source", { enum: journalSources }).notNull(),
    sourceId: uuid("source_id").notNull(),
    branchId: uuid("branch_id"),
    memo: text("memo").notNull(),
    reversesId: uuid("reverses_id"),
    actorId: uuid("actor_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("journal_entry_source").on(t.orgId, t.source, t.sourceId),
    unique("journal_entry_reverses").on(t.orgId, t.reversesId),
    index("journal_entry_posted").on(t.orgId, t.postedOn),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.reversesId], foreignColumns: [t.orgId, t.id] }),
    check(
      "journal_entry_source_kind",
      sql`${t.source} IN ('sale', 'refund', 'order', 'credit', 'loyalty', 'shift', 'stock', 'settlement', 'manual', 'reversal')`,
    ),
    check(
      "journal_entry_reversal",
      sql`(${t.source} = 'reversal') = (${t.reversesId} IS NOT NULL)`,
    ),
  ],
);

/** A signed amount on one account: debits are positive, credits negative. */
export const journalLine = pgTable(
  "journal_line",
  {
    ...tenant(),
    entryId: uuid("entry_id").notNull(),
    accountId: uuid("account_id").notNull(),
    amount: moneyColumn("amount").notNull(),
    postedOn: date("posted_on").notNull(),
    branchId: uuid("branch_id"),
    memo: text("memo"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("journal_line_entry").on(t.orgId, t.entryId),
    index("journal_line_account").on(t.orgId, t.accountId, t.postedOn),
    foreignKey({
      columns: [t.orgId, t.entryId],
      foreignColumns: [journalEntry.orgId, journalEntry.id],
    }),
    foreignKey({
      columns: [t.orgId, t.accountId],
      foreignColumns: [ledgerAccount.orgId, ledgerAccount.id],
    }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    check("journal_line_amount", sql`${t.amount} <> 0`),
  ],
);
