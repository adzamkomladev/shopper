// Direct reads of the org's books for assertions.
//   balances(filter?)         -> Map<system key or code, signed balance> (debits +, credits −), optionally for one source
//   entriesOf(source, id)     -> the journal entries a source posted, with their lines by account key
//   trialBalanceZero()        -> true when every posted line sums to zero
import { sql } from "drizzle-orm";
import type { JournalSource } from "@shopper/db-pg";
import { ids } from "../till/sales";
import { databases } from "../till/server";

export async function balances(filter: { source?: JournalSource; sourceId?: string } = {}) {
  const { rows } = await databases().db.execute<{ key: string; total: string }>(sql`
    SELECT COALESCE(a.system_key, a.code) AS key, SUM(l.amount)::text AS total
    FROM journal_line l
    JOIN journal_entry e ON e.org_id = l.org_id AND e.id = l.entry_id
    JOIN ledger_account a ON a.org_id = l.org_id AND a.id = l.account_id
    WHERE l.org_id = ${ids.org}
      ${filter.source ? sql`AND e.source = ${filter.source}` : sql``}
      ${filter.sourceId ? sql`AND e.source_id = ${filter.sourceId}` : sql``}
    GROUP BY 1`);
  return new Map(rows.map((row) => [row.key, Number(row.total)]));
}

export async function entriesOf(source: JournalSource, sourceId: string) {
  const { rows } = await databases().db.execute<{
    id: string;
    posted_on: string;
    memo: string;
    lines: Record<string, number>;
  }>(sql`
    SELECT e.id, e.posted_on::text, e.memo,
      jsonb_object_agg(COALESCE(a.system_key, a.code), l.amount) AS lines
    FROM journal_entry e
    JOIN journal_line l ON l.org_id = e.org_id AND l.entry_id = e.id
    JOIN ledger_account a ON a.org_id = l.org_id AND a.id = l.account_id
    WHERE e.org_id = ${ids.org} AND e.source = ${source} AND e.source_id = ${sourceId}
    GROUP BY e.id ORDER BY e.id`);
  return rows;
}

export async function trialBalanceZero() {
  const { rows } = await databases().db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM journal_line WHERE org_id = ${ids.org}`,
  );
  return Number(rows[0]!.total) === 0;
}
