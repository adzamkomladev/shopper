import { sql } from "drizzle-orm";
import { accraDay, onStoreDays } from "../days";
import type { FoldFilter } from "../types";

export const tenderColumns = [
  "org_id",
  "store_id",
  "branch_id",
  "day",
  "kind",
  "count",
  "amount",
  "refunded",
] as const;

const s = sql`s`;
const r = sql`r`;

/**
 * Money per tender kind on the filter's store days. `count` is the sales that used the kind; cash is net of the
 * change given, so the kinds add up to the sales' totals. A refund pays out through its tender (its total, after
 * cash rounding) and gives the rest back to the customer's account (`credit`) and points (`loyalty`), both as settled.
 */
export const foldTenders = (filter: FoldFilter) => sql`
  SELECT org_id, store_id, branch_id, day, kind,
    sum(count)::int AS count, sum(amount)::bigint AS amount, sum(refunded)::bigint AS refunded
  FROM (
    SELECT s.org_id, s.store_id, s.branch_id, ${accraDay(s)} AS day, t.kind, 1 AS count,
      sum(t.amount) - CASE WHEN t.kind = 'cash' THEN s.change ELSE 0 END AS amount, 0 AS refunded
    FROM sale s
    JOIN sale_tender t ON t.org_id = s.org_id AND t.sale_id = s.id
    WHERE ${onStoreDays(s, filter)}
    GROUP BY s.org_id, s.store_id, s.branch_id, s.id, t.kind
    UNION ALL
    SELECT r.org_id, r.store_id, r.branch_id, ${accraDay(r)}, paid.kind, 0, 0, paid.amount
    FROM refund r
    CROSS JOIN LATERAL (VALUES
      (r.tender_kind, r.total),
      ('credit', r.account_credit),
      ('loyalty', r.points_value)
    ) AS paid(kind, amount)
    WHERE ${onStoreDays(r, filter)} AND (paid.kind = r.tender_kind OR paid.amount <> 0)
  ) x
  GROUP BY org_id, store_id, branch_id, day, kind`;
