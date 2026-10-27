import { eq, sql } from "drizzle-orm";
import { store, type ShopperDatabase } from "@shopper/db-pg";
import { foldTenders } from "../../reports/fold/tenders";
import { accraDay, inBranches } from "../../reports/days";
import { inSnapshot } from "../../reports/read";

const kinds = ["cash", "card", "momo"] as const;
const p = sql`p`;
const sh = sql`sh`;

/**
 * One trading day's tender reconciliation: what each tender took (the reports' tender fold, less refunds), what the
 * day's Z reports expected and declared, and for MoMo what Paystack settled. `momo` lists the payments still
 * unsettled, the settled lines that differ from their payment, and confirmed payments no sale used (unapplied).
 */
export async function dayReconciliation(
  db: ShopperDatabase,
  orgId: string,
  query: { day: string; branchId?: string },
  scope?: string[],
) {
  const branchIds = query.branchId ? [query.branchId.toLowerCase()] : scope;
  const [taken, shifts, momo, unapplied] = await inSnapshot(db, async (tx) => {
    const stores = await tx.select({ id: store.id }).from(store).where(eq(store.orgId, orgId));
    const days = stores.map((row) => ({ storeId: row.id, day: query.day }));
    // One client runs one query at a time, so the reads go in turn.
    const taken = await (days.length
      ? tx.execute<{ kind: string; amount: string; refunded: string }>(
          sql`SELECT kind, sum(amount)::text AS amount, sum(refunded)::text AS refunded
            FROM (${foldTenders({ orgId, days, branchIds })}) t GROUP BY kind`,
        )
      : { rows: [] });
    const shifts = await tx.execute<ShiftRow>(sql`
      SELECT sh.id, sh.branch_id AS "branchId", sh.device_id AS "deviceId", sh.closed_at AS "closedAt",
        sh.closed_by AS "closedBy",
        json_agg(json_build_object('tender', st.tender, 'expected', st.expected, 'declared', st.declared,
          'variance', st.variance) ORDER BY st.tender) AS tenders
      FROM shift sh JOIN shift_tender st ON st.org_id = sh.org_id AND st.shift_id = sh.id
      WHERE sh.org_id = ${orgId} AND (sh.closed_at AT TIME ZONE 'Africa/Accra')::date = ${query.day}::date
        ${inBranches(sh, branchIds)}
      GROUP BY sh.id ORDER BY sh.closed_at`);
    const momo = await tx.execute<MomoRow>(sql`
      SELECT p.id AS "paymentId", p.reference, p.amount::bigint AS expected, l.amount::bigint AS settled,
        l.flag, se.settled_on::text AS "settledOn", s.id AS "saleId", s.receipt_number AS "receiptNumber"
      FROM sale s
      JOIN sale_tender t ON t.org_id = s.org_id AND t.sale_id = s.id AND t.kind = 'momo'
      JOIN payment p ON p.org_id = t.org_id AND p.id = t.payment_id
      LEFT JOIN settlement_line l ON l.org_id = p.org_id AND l.payment_id = p.id
      LEFT JOIN settlement se ON se.org_id = l.org_id AND se.id = l.settlement_id
      WHERE s.org_id = ${orgId} AND ${accraDay(sql`s`)} = ${query.day}::date ${inBranches(sql`s`, branchIds)}
      ORDER BY p.created_at`);
    const unapplied = await tx.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM payment p
      WHERE p.org_id = ${orgId} AND p.status = 'confirmed'
        AND (p.created_at AT TIME ZONE 'Africa/Accra')::date = ${query.day}::date ${inBranches(p, branchIds)}
        AND NOT EXISTS (SELECT 1 FROM sale_tender t WHERE t.org_id = p.org_id AND t.payment_id = p.id)`);
    return [taken, shifts, momo, unapplied] as const;
  });
  const declared = (kind: string, field: "expected" | "declared" | "variance") =>
    shifts.rows.reduce(
      (sum, shift) => sum + (shift.tenders.find((row) => row.tender === kind)?.[field] ?? 0),
      0,
    );
  return {
    day: query.day,
    tenders: kinds.map((kind) => {
      const row = taken.rows.find((r) => r.kind === kind);
      return {
        tender: kind,
        taken: Number(row?.amount ?? 0) - Number(row?.refunded ?? 0),
        expected: declared(kind, "expected"),
        declared: declared(kind, "declared"),
        variance: declared(kind, "variance"),
        settled:
          kind === "momo" ? momo.rows.reduce((sum, r) => sum + Number(r.settled ?? 0), 0) : null,
      };
    }),
    shifts: shifts.rows,
    momo: {
      unsettled: momo.rows.filter((r) => r.settled === null).length,
      mismatches: momo.rows
        .filter((r) => r.flag === "amount_mismatch")
        .map((r) => ({ ...r, expected: Number(r.expected), settled: Number(r.settled) })),
      unapplied: unapplied.rows[0]?.count ?? 0,
    },
  };
}

type ShiftRow = {
  id: string;
  branchId: string;
  deviceId: string;
  closedAt: string;
  closedBy: string;
  tenders: Array<{ tender: string; expected: number; declared: number; variance: number }>;
};

type MomoRow = {
  paymentId: string;
  reference: string;
  expected: string;
  settled: string | null;
  flag: string | null;
  settledOn: string | null;
  saleId: string;
  receiptNumber: string | null;
};
