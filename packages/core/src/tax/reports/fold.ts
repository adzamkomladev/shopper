import { sql } from "drizzle-orm";
import { add, fromBigInt, money } from "@shopper/money";
import type { TaxClass } from "@shopper/tax";
import type { Queryable } from "../../types";
import type { TaxRange } from "../../schemas/tax/returns";
import type { TaxParts } from "../types";

export const taxParts = ["base", "vat", "nhil", "getfund", "covid", "gross"] as const;
type Row = Record<(typeof taxParts)[number], string> & {
  kind: "sale" | "credit";
  period: string;
  branch_id: string;
  tax_class: TaxClass;
  registered: boolean;
};

/**
 * Sale lines and credit-note lines in an Accra date range, their stored tax snapshots summed in PostgreSQL by period,
 * branch, class and whether the shop was VAT-registered. A sale line counts on its tax date; a credit note on the
 * day it was made, whatever the date of the sale it returns. Nothing is recomputed: the snapshots are the record.
 */
export async function foldTax(db: Queryable, orgId: string, range: TaxRange) {
  const { rows } = await db.execute<Row>(sql`
    SELECT kind,
      ${range.group === "month" ? sql`left(day, 7)` : sql`day`} AS period,
      branch_id,
      tax->>'taxClass' AS tax_class,
      coalesce((tax->>'registered')::boolean, true) AS registered,
      ${sql.join(
        taxParts.map(
          (part) => sql`coalesce(sum((tax->>${part})::bigint), 0)::text AS ${sql.identifier(part)}`,
        ),
        sql`, `,
      )}
    FROM (
      SELECT 'sale' AS kind, l.payload->'tax'->>'on' AS day, s.branch_id, l.payload->'tax' AS tax
        FROM sale_line l JOIN sale s ON s.org_id = l.org_id AND s.id = l.sale_id
        WHERE l.org_id = ${orgId}
      UNION ALL
      SELECT 'credit', to_char(r.occurred_at AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD'), r.branch_id, rl.payload->'tax'
        FROM refund_line rl JOIN refund r ON r.org_id = rl.org_id AND r.id = rl.refund_id
        WHERE rl.org_id = ${orgId}
    ) line
    WHERE day BETWEEN ${range.from} AND ${range.to}
      ${range.branchId ? sql`AND branch_id = ${range.branchId}` : sql``}
    GROUP BY 1, 2, 3, 4, 5
    ORDER BY 2, 3, 4`);
  return rows.map((row) => ({
    kind: row.kind,
    period: row.period,
    branchId: row.branch_id,
    taxClass: row.tax_class,
    registered: row.registered,
    ...(Object.fromEntries(
      taxParts.map((part) => [part, fromBigInt(BigInt(row[part]))]),
    ) as TaxParts),
  }));
}

/** Sums tax parts; an empty list is all zeros. */
export const addParts = (rows: TaxParts[]) =>
  Object.fromEntries(
    taxParts.map((part) => [part, rows.reduce((total, row) => add(total, row[part]), money(0))]),
  ) as TaxParts;
