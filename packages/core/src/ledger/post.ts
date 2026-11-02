import { and, eq, inArray } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  journalEntry,
  journalLine,
  ledgerAccount,
  org,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, money, mulRatio, type Money } from "@shopper/money";
import { LedgerError } from "./error";
import type { Entry, Posting } from "./types";

/**
 * Posts one balanced entry inside the caller's transaction, so the books move with the change that caused them.
 * Zero lines are dropped and lines on the same account (and memo) merged. A source posts once: a replayed command
 * gets null back and posts nothing. Returns the entry id, or null when there was nothing (more) to post.
 */
export async function postEntry(tx: ShopperTransaction, ctx: CommandContext, entry: Entry) {
  const ids = await accountIds(tx, ctx.orgId, entry.lines);
  const merged = new Map<string, { accountId: string; amount: Money; memo?: string }>();
  for (const line of entry.lines) {
    const accountId = typeof line.account === "string" ? ids.get(line.account)! : line.account.id;
    const key = `${accountId}:${line.memo ?? ""}`;
    const found = merged.get(key);
    merged.set(key, {
      accountId,
      memo: line.memo,
      amount: add(found?.amount ?? money(0), line.amount),
    });
  }
  const lines = [...merged.values()].filter((line) => line.amount !== 0);
  if (lines.reduce((sum, line) => add(sum, line.amount), money(0)) !== 0)
    throw new LedgerError(`The ${entry.source} posting does not balance`, 422);
  if (!lines.length) return null;
  const postedOn = await postingDay(tx, ctx.orgId, entry.occurredAt);
  const [saved] = await tx
    .insert(journalEntry)
    .values({
      orgId: ctx.orgId,
      postedOn,
      occurredAt: entry.occurredAt,
      source: entry.source,
      sourceId: entry.sourceId,
      branchId: entry.branchId ?? null,
      memo: entry.memo,
      reversesId: entry.reversesId ?? null,
      actorId: ctx.actorId ?? null,
    })
    .onConflictDoNothing({
      target: [journalEntry.orgId, journalEntry.source, journalEntry.sourceId],
    })
    .returning({ id: journalEntry.id });
  if (!saved) return null;
  await tx.insert(journalLine).values(
    lines.map((line) => ({
      orgId: ctx.orgId,
      entryId: saved.id,
      accountId: line.accountId,
      amount: line.amount,
      postedOn,
      branchId: entry.branchId ?? null,
      memo: line.memo ?? null,
    })),
  );
  return saved.id;
}

/** The amount on the other side: a debit as a credit, a credit as a debit. */
export const negate = (amount: Money) => mulRatio(amount, -1, 1);

/** The Accra day (Accra keeps UTC all year) an entry counts on: its own, or the day after the books' lock date. */
export async function postingDay(tx: ShopperTransaction, orgId: string, at: Date) {
  const day = at.toISOString().slice(0, 10);
  const [found] = await tx
    .select({ locked: org.ledgerLockedThrough })
    .from(org)
    .where(eq(org.id, orgId));
  if (!found?.locked || day > found.locked) return day;
  return nextDay(found.locked);
}

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

async function accountIds(tx: ShopperTransaction, orgId: string, lines: Posting[]) {
  const keys = [
    ...new Set(lines.flatMap((line) => (typeof line.account === "string" ? [line.account] : []))),
  ];
  if (!keys.length) return new Map<string, string>();
  const rows = await tx
    .select({ id: ledgerAccount.id, key: ledgerAccount.systemKey })
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.orgId, orgId), inArray(ledgerAccount.systemKey, keys)));
  return new Map(rows.map((row) => [row.key!, row.id]));
}
