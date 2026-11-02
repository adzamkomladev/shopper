import * as v from "valibot";
import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { journalEntry, journalLine, ledgerAccount, org } from "@shopper/db-pg";
import { add, money } from "@shopper/money";
import { journalQuery, rangeQuery } from "../schemas/ledger/inputs";
import type { Queryable } from "../types";
import { describe } from "./chart";
import { LedgerError } from "./error";

/** The org's chart in code order, each account with its balance to date (debits +), and the lock date. */
export async function listAccounts(db: Queryable, orgId: string) {
  const rows = await db
    .select({
      account: ledgerAccount,
      balance: sql<string>`COALESCE(SUM(${journalLine.amount}), 0)::text`,
    })
    .from(ledgerAccount)
    .leftJoin(
      journalLine,
      and(eq(journalLine.orgId, ledgerAccount.orgId), eq(journalLine.accountId, ledgerAccount.id)),
    )
    .where(eq(ledgerAccount.orgId, orgId))
    .groupBy(ledgerAccount.id)
    .orderBy(asc(ledgerAccount.code));
  const [books] = await db
    .select({ locked: org.ledgerLockedThrough })
    .from(org)
    .where(eq(org.id, orgId));
  return {
    lockedThrough: books?.locked ?? null,
    accounts: rows.map((row) => ({ ...describe(row.account), balance: Number(row.balance) })),
  };
}

/** Journal entries posted in a range, newest first, with their lines and which entry reversed each. */
export async function listJournal(db: Queryable, orgId: string, raw: unknown) {
  const query = v.parse(journalQuery, raw);
  const entries = await db
    .select()
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.orgId, orgId),
        gte(journalEntry.postedOn, query.from),
        lte(journalEntry.postedOn, query.to),
        query.source ? eq(journalEntry.source, query.source) : undefined,
      ),
    )
    .orderBy(sql`${journalEntry.postedOn} DESC`, sql`${journalEntry.id} DESC`)
    .limit(500);
  const ids = entries.map((entry) => entry.id);
  const lines = ids.length
    ? await db
        .select({ line: journalLine, code: ledgerAccount.code, name: ledgerAccount.name })
        .from(journalLine)
        .innerJoin(
          ledgerAccount,
          and(
            eq(ledgerAccount.orgId, journalLine.orgId),
            eq(ledgerAccount.id, journalLine.accountId),
          ),
        )
        .where(and(eq(journalLine.orgId, orgId), inArray(journalLine.entryId, ids)))
        .orderBy(sql`${journalLine.amount} < 0`, ledgerAccount.code)
    : [];
  const reversals = ids.length
    ? await db
        .select({ id: journalEntry.id, reversesId: journalEntry.reversesId })
        .from(journalEntry)
        .where(and(eq(journalEntry.orgId, orgId), inArray(journalEntry.reversesId, ids)))
    : [];
  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      postedOn: entry.postedOn,
      occurredAt: entry.occurredAt.toISOString(),
      source: entry.source,
      sourceId: entry.sourceId,
      memo: entry.memo,
      reversesId: entry.reversesId,
      reversedBy: reversals.find((row) => row.reversesId === entry.id)?.id ?? null,
      lines: lines
        .filter((row) => row.line.entryId === entry.id)
        .map((row) => ({
          accountId: row.line.accountId,
          code: row.code,
          name: row.name,
          amount: row.line.amount,
          memo: row.line.memo,
        })),
    })),
  };
}

/** One account's lines in a range with the running balance, from the balance before the range to the one after. */
export async function accountLines(db: Queryable, orgId: string, accountId: string, raw: unknown) {
  const query = v.parse(rangeQuery, raw);
  const [account] = await db
    .select()
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.orgId, orgId), eq(ledgerAccount.id, accountId)));
  if (!account) throw new LedgerError("Unknown account", 404);
  const mine = and(eq(journalLine.orgId, orgId), eq(journalLine.accountId, accountId));
  const [before] = await db
    .select({ total: sql<string>`COALESCE(SUM(${journalLine.amount}), 0)::text` })
    .from(journalLine)
    .where(and(mine, lt(journalLine.postedOn, query.from)));
  const rows = await db
    .select({ line: journalLine, entry: journalEntry })
    .from(journalLine)
    .innerJoin(
      journalEntry,
      and(eq(journalEntry.orgId, journalLine.orgId), eq(journalEntry.id, journalLine.entryId)),
    )
    .where(and(mine, gte(journalLine.postedOn, query.from), lte(journalLine.postedOn, query.to)))
    .orderBy(journalLine.postedOn, journalEntry.occurredAt, journalLine.id);
  const opening = money(Number(before!.total));
  let balance = opening;
  const lines = rows.map((row) => {
    balance = add(balance, row.line.amount);
    return {
      entryId: row.entry.id,
      postedOn: row.line.postedOn,
      occurredAt: row.entry.occurredAt.toISOString(),
      source: row.entry.source,
      sourceId: row.entry.sourceId,
      memo: row.line.memo ?? row.entry.memo,
      amount: row.line.amount,
      balance,
    };
  });
  return { account: describe(account), opening, closing: balance, lines };
}
