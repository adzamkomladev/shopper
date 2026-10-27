import { sql } from "drizzle-orm";
import { accraDay, dayStart, onStoreDays, taxSum } from "../days";
import type { FoldFilter } from "../types";

export const productColumns = [
  "org_id",
  "store_id",
  "branch_id",
  "day",
  "product_id",
  "quantity",
  "gross",
  "discount",
  "tax",
  "net",
  "cost",
  "uncosted",
  "refund_quantity",
  "refund_gross",
  "refund_net",
  "refund_cost",
] as const;

const s = sql`s`;
const r = sql`r`;
/**
 * A day's quantity at a unit cost, as `mulQty` from @shopper/money rounds it (half up; both are non-negative), so
 * the cost can be summed in the database. `sum` of a bigint is numeric: it is cast back so `/` divides whole numbers. A day without a costed receipt costs nothing and counts as uncosted.
 */
const costOf = (quantity: string) =>
  sql`CASE WHEN unit_cost IS NULL THEN 0 ELSE (unit_cost * sum(${sql.raw(quantity)})::bigint + 500) / 1000 END`;

/**
 * Each product's sold and refunded lines on the filter's store days. Every line of a branch, product and day takes
 * the unit cost of the branch's latest costed receipt on or before that day, so the cost is figured once per day.
 */
export const foldProducts = (filter: FoldFilter) => sql`
  SELECT org_id, store_id, branch_id, day, product_id,
    sum(quantity)::bigint AS quantity, sum(gross)::bigint AS gross, sum(discount)::bigint AS discount,
    sum(tax)::bigint AS tax, sum(net)::bigint AS net, ${costOf("quantity")}::bigint AS cost,
    CASE WHEN unit_cost IS NULL THEN sum(quantity) ELSE 0 END::bigint AS uncosted,
    sum(refund_quantity)::bigint AS refund_quantity, sum(refund_gross)::bigint AS refund_gross,
    sum(refund_net)::bigint AS refund_net, ${costOf("refund_quantity")}::bigint AS refund_cost
  FROM (
    SELECT line.*, (
      SELECT m.unit_cost FROM stock_movement m
      WHERE m.org_id = line.org_id AND m.branch_id = line.branch_id AND m.product_id = line.product_id
        AND m.reason = 'receipt' AND m.unit_cost IS NOT NULL
        AND m.occurred_at < ${dayStart(sql`(line.day + 1)`)}
      ORDER BY m.occurred_at DESC, m.id DESC LIMIT 1
    ) AS unit_cost
    FROM (
      SELECT s.org_id, s.store_id, s.branch_id, ${accraDay(s)} AS day, l.product_id,
        (l.payload->'tax'->>'quantityThousandths')::bigint AS quantity,
        (l.payload->'tax'->>'gross')::bigint AS gross, (l.payload->>'discount')::bigint AS discount,
        ${taxSum("l.payload->'tax'")} AS tax, (l.payload->'tax'->>'base')::bigint AS net,
        0 AS refund_quantity, 0 AS refund_gross, 0 AS refund_net
      FROM sale s JOIN sale_line l ON l.org_id = s.org_id AND l.sale_id = s.id
      WHERE ${onStoreDays(s, filter)}
      UNION ALL
      SELECT r.org_id, r.store_id, r.branch_id, ${accraDay(r)}, rl.product_id, 0, 0, 0, 0, 0,
        rl.quantity_thousandths, (rl.payload->'tax'->>'gross')::bigint, (rl.payload->'tax'->>'base')::bigint
      FROM refund r JOIN refund_line rl ON rl.org_id = r.org_id AND rl.refund_id = r.id
      WHERE ${onStoreDays(r, filter)}
    ) line
  ) costed
  GROUP BY org_id, store_id, branch_id, day, product_id, unit_cost`;
