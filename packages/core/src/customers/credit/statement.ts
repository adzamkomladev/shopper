import { sql } from "drizzle-orm";
import * as v from "valibot";
import { fromBigInt } from "@shopper/money";
import { statementQuery } from "../../schemas/customers/credit";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";

type Entry = {
  id: string;
  kind: string;
  amount: string;
  balance: string;
  method: string | null;
  reason: string | null;
  sale_id: string | null;
  refund_id: string | null;
  occurred_at: string;
};

/**
 * The account between two inclusive days: what was owed before the first, each entry with the running balance
 * after it, and what was owed at the end of the last. Below zero is a deposit.
 */
export async function readStatement(db: Queryable, orgId: string, id: string, raw: unknown) {
  const { from, to } = v.parse(statementQuery, raw);
  const current = await readCustomerRow(db, orgId, id);
  const start = `${from}T00:00:00Z`;
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString();
  const opening = await sumBefore(db, orgId, current.id, start);
  const { rows } = await db.execute<Entry>(sql`
    SELECT id, kind, amount::text, method, reason, sale_id, refund_id,
      to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      (${opening.toString()}::bigint + SUM(amount) OVER (ORDER BY occurred_at, id))::text AS balance
    FROM credit_entry
    WHERE org_id = ${orgId} AND customer_id = ${current.id}
      AND occurred_at >= ${start}::timestamptz AND occurred_at < ${end}::timestamptz
    ORDER BY occurred_at, id`);
  const entries = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    amount: fromBigInt(BigInt(row.amount)),
    balance: fromBigInt(BigInt(row.balance)),
    method: row.method,
    reason: row.reason,
    saleId: row.sale_id,
    refundId: row.refund_id,
    occurredAt: row.occurred_at,
  }));
  const openingBalance = fromBigInt(opening);
  return {
    customerId: current.id,
    from,
    to,
    opening: openingBalance,
    entries,
    closing: entries.at(-1)?.balance ?? openingBalance,
  };
}

async function sumBefore(db: Queryable, orgId: string, customerId: string, before: string) {
  const { rows } = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(amount), 0)::text AS total FROM credit_entry
    WHERE org_id = ${orgId} AND customer_id = ${customerId} AND occurred_at < ${before}::timestamptz`);
  return BigInt(rows[0]!.total);
}
