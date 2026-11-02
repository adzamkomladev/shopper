// The books are append-only balanced postings on each org's chart of accounts:
//   - every org starts with the system chart (a trigger on org seeds it, however the org is made);
//   - the database refuses, at commit, an entry whose lines do not sum to zero or that has one line, and refuses any
//     change to a posted entry or line;
//   - postEntry posts a source once (replays are no-ops), merges lines per account and drops zero lines;
//   - an entry dated on or before the lock date counts on the first open day and keeps when it happened.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { journalEntry, journalLine, ledgerAccount, org } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { postEntry } from "@shopper/core/ledger";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";

let accounts: Map<string, string>;
beforeAll(async () => {
  const rows = await databases()
    .db.select({ id: ledgerAccount.id, key: ledgerAccount.systemKey })
    .from(ledgerAccount)
    .where(eq(ledgerAccount.orgId, ids.org));
  accounts = new Map(rows.map((row) => [row.key!, row.id]));
});

/** A raw entry with the given line amounts, in one transaction, the way only a bug or an attacker would write it. */
async function rawEntry(amounts: number[]) {
  const id = v7();
  await databases().db.transaction(async (tx) => {
    await tx.insert(journalEntry).values({
      id,
      orgId: ids.org,
      postedOn: "2026-10-15",
      occurredAt: new Date("2026-10-15T09:00:00Z"),
      source: "manual",
      sourceId: id,
      memo: "raw",
    });
    for (const [index, amount] of amounts.entries())
      await tx.insert(journalLine).values({
        orgId: ids.org,
        entryId: id,
        accountId: [...accounts.values()][index]!,
        amount: money(amount),
        postedOn: "2026-10-15",
      });
  });
  return id;
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "committed",
    (error: { message: string; cause?: { message: string } }) =>
      error.cause?.message ?? error.message,
  );

test("every org, existing or new, starts with the system chart of accounts", async () => {
  const { db } = databases();
  expect(accounts.size).toBe(24);
  expect(accounts.has("cash_drawer") && accounts.has("vat") && accounts.has("cogs")).toBe(true);
  const created = await provisionOrg(db, provisioningContext(), {
    name: "Ledger Mart",
    slug: `ledger-${v7().slice(-6)}`,
  });
  const [{ count }] = (
    await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM ledger_account WHERE org_id = ${created.id} AND system_key IS NOT NULL`,
    )
  ).rows as [{ count: number }];
  expect(count).toBe(24);
});

test("the database refuses an unbalanced or one-line entry when it commits", async () => {
  expect(await failure(rawEntry([10_000, -9_999]))).toMatch(/does not balance/);
  expect(await failure(rawEntry([10_000]))).toMatch(/does not balance/);
  expect(await failure(rawEntry([10_000, -4_000, -6_000]))).toBe("committed");
});

test("a posted entry and its lines can never change", async () => {
  const { db } = databases();
  const id = await rawEntry([2_500, -2_500]);
  expect(
    await failure(
      db
        .update(journalLine)
        .set({ amount: money(1) })
        .where(eq(journalLine.entryId, id)),
    ),
  ).toMatch(/append-only|history/i);
  expect(await failure(db.delete(journalLine).where(eq(journalLine.entryId, id)))).toMatch(
    /append-only|history/i,
  );
  expect(await failure(db.delete(journalEntry).where(eq(journalEntry.id, id)))).toMatch(
    /append-only|history/i,
  );
});

test("postEntry posts a source once, merging lines per account and dropping zero lines", async () => {
  const { db, context } = databases();
  const sourceId = v7();
  const post = () =>
    db.transaction((tx) =>
      postEntry(tx, context, {
        source: "sale",
        sourceId,
        occurredAt: new Date("2026-10-15T10:00:00Z"),
        branchId: ids.branch,
        memo: "Sale 0001",
        lines: [
          { account: "cash_drawer", amount: money(8_000) },
          { account: "cash_drawer", amount: money(4_000) },
          { account: "rounding", amount: money(0) },
          { account: "sales", amount: money(-10_000) },
          { account: "vat", amount: money(-2_000) },
        ],
      }),
    );
  const first = await post();
  expect(first).toEqual(expect.any(String));
  expect(await post()).toBeNull();
  const lines = await db
    .select({ accountId: journalLine.accountId, amount: journalLine.amount })
    .from(journalLine)
    .where(and(eq(journalLine.orgId, ids.org), eq(journalLine.entryId, first!)));
  expect(new Map(lines.map((line) => [line.accountId, line.amount]))).toEqual(
    new Map([
      [accounts.get("cash_drawer"), 12_000],
      [accounts.get("sales"), -10_000],
      [accounts.get("vat"), -2_000],
    ]),
  );
  await expect(
    db.transaction((tx) =>
      postEntry(tx, context, {
        source: "sale",
        sourceId: v7(),
        occurredAt: new Date(),
        memo: "broken",
        lines: [
          { account: "cash_drawer", amount: money(1) },
          { account: "sales", amount: money(-2) },
        ],
      }),
    ),
  ).rejects.toThrow(/balance/);
});

test("an entry dated on or before the lock date counts on the first open day", async () => {
  const { db, context } = databases();
  await db.update(org).set({ ledgerLockedThrough: "2026-10-31" }).where(eq(org.id, ids.org));
  const occurredAt = new Date("2026-10-20T23:30:00Z");
  const id = await db.transaction((tx) =>
    postEntry(tx, context, {
      source: "sale",
      sourceId: v7(),
      occurredAt,
      memo: "late offline sale",
      lines: [
        { account: "cash_drawer", amount: money(5_000) },
        { account: "sales", amount: money(-5_000) },
      ],
    }),
  );
  const [entry] = await db.select().from(journalEntry).where(eq(journalEntry.id, id!));
  expect(entry!.postedOn).toBe("2026-11-01");
  expect(entry!.occurredAt.toISOString()).toBe(occurredAt.toISOString());
  await db.update(org).set({ ledgerLockedThrough: null }).where(eq(org.id, ids.org));
});
