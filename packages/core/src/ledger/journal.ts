import * as v from "valibot";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  branch,
  journalEntry,
  journalLine,
  ledgerAccount,
  org,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { ledgerId, manualJournalInput, reversalInput } from "../schemas/ledger/inputs";
import { LedgerError } from "./error";
import { negate, postEntry } from "./post";

/** Posts a hand-written entry on open days only; the same id posted again returns the entry already there. */
export const postManualJournal = defineCommand({
  name: "ledger.journal.post",
  async run(tx, ctx, input: { journal: unknown }) {
    const journal = v.parse(manualJournalInput, input.journal);
    await requireOpen(tx, ctx.orgId, journal.postedOn);
    const accounts = await tx
      .select({ id: ledgerAccount.id })
      .from(ledgerAccount)
      .where(
        and(
          eq(ledgerAccount.orgId, ctx.orgId),
          inArray(
            ledgerAccount.id,
            journal.lines.map((line) => line.accountId),
          ),
        ),
      );
    const known = new Set(accounts.map((row) => row.id));
    if (journal.lines.some((line) => !known.has(line.accountId)))
      throw new LedgerError("Unknown account", 404);
    await requireActive(tx, ctx.orgId, [...known]);
    if (journal.branchId) {
      const [site] = await tx
        .select({ id: branch.id })
        .from(branch)
        .where(and(eq(branch.orgId, ctx.orgId), eq(branch.id, journal.branchId)));
      if (!site) throw new LedgerError("Unknown branch", 404);
    }
    await postEntry(tx, ctx, {
      source: "manual",
      sourceId: journal.id,
      occurredAt: new Date(`${journal.postedOn}T12:00:00Z`),
      branchId: journal.branchId,
      memo: journal.memo,
      lines: journal.lines.map((line) => ({
        account: { id: line.accountId },
        amount: money(line.amount),
        memo: line.memo,
      })),
    });
    return { id: await entryIdOf(tx, ctx.orgId, "manual", journal.id) };
  },
  audit: (input, output) => ({ ...output, journal: input.journal }),
  details: (_input, output) => ({ entity: "journal_entry", entityId: output.id }),
});

/** Posts the mirror of a manual entry once, on an open day no earlier than its own; a reversal is final. */
export const reverseJournal = defineCommand({
  name: "ledger.journal.reverse",
  async run(tx, ctx, input: { entryId: string; body: unknown }) {
    if (!v.is(ledgerId, input.entryId)) throw new LedgerError("Unknown journal entry", 404);
    const body = v.parse(reversalInput, input.body);
    const [original] = await tx
      .select()
      .from(journalEntry)
      .where(and(eq(journalEntry.orgId, ctx.orgId), eq(journalEntry.id, input.entryId)));
    if (!original) throw new LedgerError("Unknown journal entry", 404);
    if (original.source === "reversal") throw new LedgerError("A reversal cannot be reversed", 422);
    // A synced posting is corrected by a new manual entry; reversing it would leave its sale or shift unbooked.
    if (original.source !== "manual")
      throw new LedgerError("Only a hand-written entry can be reversed", 422);
    if (body.postedOn < original.postedOn)
      throw new LedgerError("A reversal cannot be dated before the entry it reverses", 422);
    await requireOpen(tx, ctx.orgId, body.postedOn);
    const lines = await tx
      .select()
      .from(journalLine)
      .where(and(eq(journalLine.orgId, ctx.orgId), eq(journalLine.entryId, original.id)));
    const id = await postEntry(tx, ctx, {
      source: "reversal",
      sourceId: original.id,
      reversesId: original.id,
      occurredAt: new Date(`${body.postedOn}T12:00:00Z`),
      branchId: original.branchId ?? undefined,
      memo: `Reversal of ${original.memo}`,
      lines: lines.map((line) => ({
        account: { id: line.accountId },
        amount: negate(line.amount),
        memo: line.memo ?? undefined,
      })),
    });
    if (!id) throw new LedgerError("This entry is already reversed", 409);
    return { id, reversesId: original.id };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "journal_entry", entityId: output.id }),
});

/** Refuses a hand-written day on or before the lock date; synced activity instead moves to the first open day. */
async function requireOpen(tx: ShopperTransaction, orgId: string, day: string) {
  const [found] = await tx
    .select({ locked: org.ledgerLockedThrough })
    .from(org)
    .where(eq(org.id, orgId));
  if (found?.locked && day <= found.locked)
    throw new LedgerError(`The books are locked through ${found.locked}`, 409);
}

async function requireActive(tx: ShopperTransaction, orgId: string, ids: string[]) {
  const active = await tx
    .select({ id: ledgerAccount.id })
    .from(ledgerAccount)
    .where(
      and(
        eq(ledgerAccount.orgId, orgId),
        inArray(ledgerAccount.id, ids),
        isNull(ledgerAccount.archivedAt),
      ),
    );
  if (active.length < ids.length)
    throw new LedgerError("An archived account takes no new lines", 422);
}

async function entryIdOf(
  tx: ShopperTransaction,
  orgId: string,
  source: "manual",
  sourceId: string,
) {
  const [row] = await tx
    .select({ id: journalEntry.id })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.orgId, orgId),
        eq(journalEntry.source, source),
        eq(journalEntry.sourceId, sourceId),
      ),
    );
  return row!.id;
}
