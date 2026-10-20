import { sql } from "drizzle-orm";
import { StockError } from "./error";
import { onHand } from "./onhand";
import type { Queryable } from "../types";

/**
 * What each count line moves: counted minus on hand at the line's own time. A newer count of the
 * same product at that branch makes the older one SUPERSEDED.
 */
// ponytail: late offline sales dated before a line's time shift its delta, and an older count is
// rejected whole once a newer one exists; upgrade with a count-aware on-hand projection that
// re-bases later counts.
export async function countDeltas(
  db: Queryable,
  orgId: string,
  branchId: string,
  lines: { productId: string; countedThousandths: number; at: Date }[],
) {
  const json = JSON.stringify(lines.map((l) => ({ product_id: l.productId, at: l.at })));
  const { rows } = await db.execute<{ product_id: string }>(sql`
    SELECT i.product_id
    FROM jsonb_to_recordset(${json}::jsonb) AS i(product_id uuid, at timestamptz)
    JOIN stock_movement m
      ON m.org_id = ${orgId} AND m.branch_id = ${branchId} AND m.product_id = i.product_id
      AND m.reason = 'count' AND m.occurred_at > i.at
    LIMIT 1`);
  if (rows[0]) throw new StockError("SUPERSEDED", `A newer count exists for ${rows[0].product_id}`);
  const before = await onHand(
    db,
    orgId,
    branchId,
    lines.map((l) => ({ productId: l.productId, at: l.at })),
  );
  return new Map(lines.map((l) => [l.productId, l.countedThousandths - before.get(l.productId)!]));
}
