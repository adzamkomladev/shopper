import * as v from "valibot";
import { sql, type SQL } from "drizzle-orm";
import type { ShopperDatabase } from "@shopper/db-pg";
import { dayStart, inBranches } from "../reports/days";
import { inSnapshot } from "../reports/read";
import { transactionQuery } from "./schemas/base";
import type { TransactionRow } from "./types";

/**
 * One page of the explorer, newest first: the org's sales (completed, or refunded once any refund exists) and its
 * MoMo payments no sale used (pending), with counts per status for the same range, search and filters.
 */
export async function listTransactions(
  db: ShopperDatabase,
  orgId: string,
  raw: Record<string, string>,
  scope?: string[],
) {
  const query = v.parse(transactionQuery, raw);
  const cursor = query.cursor?.split(".");
  return inSnapshot(db, async (tx) => {
    const page = await tx.execute<TransactionRow>(sql`
        SELECT * FROM (${matching(orgId, query, scope)}) m
        WHERE ${query.status === "all" ? sql`true` : sql`m.status = ${query.status}`}
          ${cursor ? sql`AND (m."occurredAt", m.id) < (to_timestamp(${Number(cursor[0])} / 1000.0), ${cursor[1]}::uuid)` : sql``}
        ORDER BY m."occurredAt" DESC, m.id DESC
        LIMIT ${query.limit + 1}`);
    const counts = await tx.execute<
      Record<"all" | "completed" | "refunded" | "pending", number>
    >(sql`
        SELECT count(*)::int AS all,
          count(*) FILTER (WHERE status = 'completed')::int AS completed,
          count(*) FILTER (WHERE status = 'refunded')::int AS refunded,
          count(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM (${matching(orgId, query, scope)}) m`);
    const rows = page.rows.slice(0, query.limit).map(toRow);
    const last = rows.at(-1);
    return {
      rows,
      counts: counts.rows[0]!,
      next:
        page.rows.length > query.limit && last ? `${Date.parse(last.occurredAt)}.${last.id}` : null,
    };
  });
}

/** Every row the filters match, unpaged (also the CSV's rows). */
export function matching(
  orgId: string,
  query: v.InferOutput<typeof transactionQuery>,
  scope?: string[],
) {
  const branchIds = query.branchId ? [query.branchId.toLowerCase()] : scope;
  const from = dayStart(query.from);
  const to = dayStart(sql`(${query.to}::date + 1)`);
  const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const search = (fields: SQL) => (query.q ? sql`AND (${fields})` : sql``);
  return sql`
    SELECT s.id, 'sale' AS kind, date_trunc('milliseconds', s.occurred_at) AS "occurredAt", s.receipt_number AS "receiptNumber",
      s.branch_id AS "branchId", s.cashier_id AS "cashierId", u.name AS "cashierName",
      s.customer_id AS "customerId", c.name AS "customerName", s.total::bigint AS total,
      CASE WHEN EXISTS (SELECT 1 FROM refund r WHERE r.org_id = s.org_id AND r.original_sale_id = s.id)
        THEN 'refunded' ELSE 'completed' END AS status,
      (SELECT array_agg(DISTINCT t.kind ORDER BY t.kind) FROM sale_tender t
        WHERE t.org_id = s.org_id AND t.sale_id = s.id) AS tenders,
      (SELECT count(*)::int FROM sale_line l WHERE l.org_id = s.org_id AND l.sale_id = s.id) AS items
    FROM sale s
    LEFT JOIN "user" u ON u.org_id = s.org_id AND u.id = s.cashier_id
    LEFT JOIN customer c ON c.org_id = s.org_id AND c.id = s.customer_id
    WHERE s.org_id = ${orgId} AND s.occurred_at >= ${from} AND s.occurred_at < ${to}
      ${inBranches(sql`s`, branchIds)}
      ${query.cashierId ? sql`AND s.cashier_id = ${query.cashierId}` : sql``}
      ${query.tender ? sql`AND EXISTS (SELECT 1 FROM sale_tender t WHERE t.org_id = s.org_id AND t.sale_id = s.id AND t.kind = ${query.tender})` : sql``}
      ${search(sql`s.receipt_number ILIKE ${like} OR c.name ILIKE ${like} OR c.phone ILIKE ${like}
        OR EXISTS (SELECT 1 FROM sale_tender t LEFT JOIN payment p ON p.org_id = t.org_id AND p.id = t.payment_id
          WHERE t.org_id = s.org_id AND t.sale_id = s.id AND (t.reference = ${query.q} OR p.reference = ${query.q}))`)}
    UNION ALL
    SELECT p.id, 'payment', date_trunc('milliseconds', p.created_at), NULL, p.branch_id, p.cashier_id, u.name, NULL, NULL,
      p.amount::bigint, 'pending', ARRAY['momo'], 0
    FROM payment p
    LEFT JOIN "user" u ON u.org_id = p.org_id AND u.id = p.cashier_id
    WHERE p.org_id = ${orgId} AND p.created_at >= ${from} AND p.created_at < ${to}
      AND (p.status IN ('pending', 'otp')
        OR (p.status = 'confirmed' AND NOT EXISTS (
          SELECT 1 FROM sale_tender t WHERE t.org_id = p.org_id AND t.payment_id = p.id)))
      ${inBranches(sql`p`, branchIds)}
      ${query.cashierId ? sql`AND p.cashier_id = ${query.cashierId}` : sql``}
      ${query.tender && query.tender !== "momo" ? sql`AND false` : sql``}
      ${search(sql`p.reference = ${query.q} OR p.phone ILIKE ${like}`)}`;
}

const toRow = (row: TransactionRow) => ({
  ...row,
  occurredAt: new Date(row.occurredAt).toISOString(),
  total: Number(row.total),
});
