import { sql } from "drizzle-orm";
import { accraDay, accraHour, onStoreDays, taxSum } from "../days";
import type { FoldFilter } from "../types";

/** The `report_sales` columns in table order after the key: what a fold yields and a rollup stores. */
export const salesColumns = [
  "org_id",
  "store_id",
  "branch_id",
  "day",
  "hour",
  "cashier_id",
  "sales",
  "items",
  "gross",
  "discount",
  "tax",
  "vat",
  "nhil",
  "getfund",
  "covid",
  "net",
  "rounding",
  "refunds",
  "refund_gross",
  "refund_tax",
  "refund_vat",
  "refund_nhil",
  "refund_getfund",
  "refund_covid",
  "refund_net",
  "refund_rounding",
] as const;

const levies = ["vat", "nhil", "getfund", "covid"];
/** `sum(column)::bigint AS column` for the summed columns: everything after the key. */
const totals = sql.raw(
  salesColumns
    .slice(6)
    .map(
      (column) =>
        `sum(${column})::${column === "sales" || column === "refunds" ? "int" : "bigint"} AS ${column}`,
    )
    .join(", "),
);
const levyOf = (path: string, prefix = "") =>
  sql.raw(levies.map((levy) => `(${path}->>'${levy}')::bigint AS ${prefix}${levy}`).join(", "));

const s = sql`s`;
const r = sql`r`;

/**
 * Sales and refunds on the filter's store days, summed per branch, day, Accra hour and cashier. Sale amounts come
 * from the stored sale totals (gross = base + tax + the tax rounding adjustment) and its cash rounding; a refund
 * counts on the day it was made, its tax and base summed from its lines, with its own cash rounding. Online orders
 * have no cashier (a null one) and no cash rounding.
 */
export const foldSales = (filter: FoldFilter) => sql`
  SELECT org_id, store_id, branch_id, day, hour, cashier_id, ${totals}
  FROM (
    SELECT s.org_id, s.store_id, s.branch_id, ${accraDay(s)} AS day, ${accraHour(s)} AS hour, s.cashier_id,
      1 AS sales,
      (SELECT coalesce(sum((l->'tax'->>'quantityThousandths')::bigint), 0)
         FROM jsonb_array_elements(s.payload->'lines') l) AS items,
      (s.payload->'totals'->>'gross')::bigint AS gross,
      (SELECT coalesce(sum((l->>'discount')::bigint), 0)
         FROM jsonb_array_elements(s.payload->'lines') l) AS discount,
      ${taxSum("s.payload->'totals'")} AS tax, ${levyOf("s.payload->'totals'")},
      (s.payload->'totals'->>'base')::bigint AS net,
      s.cash_rounding AS rounding,
      0 AS refunds, 0 AS refund_gross, 0 AS refund_tax, 0 AS refund_vat, 0 AS refund_nhil, 0 AS refund_getfund,
      0 AS refund_covid, 0 AS refund_net, 0 AS refund_rounding
    FROM sale s
    WHERE ${onStoreDays(s, filter)}
    UNION ALL
    SELECT r.org_id, r.store_id, r.branch_id, ${accraDay(r)}, ${accraHour(r)}, r.cashier_id,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      1, r.gross, lines.tax, lines.vat, lines.nhil, lines.getfund, lines.covid, lines.net, r.cash_rounding
    FROM refund r
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(${taxSum("rl.payload->'tax'")}), 0) AS tax,
        ${sql.raw(levies.map((levy) => `coalesce(sum((rl.payload->'tax'->>'${levy}')::bigint), 0) AS ${levy}`).join(", "))},
        coalesce(sum((rl.payload->'tax'->>'base')::bigint), 0) AS net
      FROM refund_line rl WHERE rl.org_id = r.org_id AND rl.refund_id = r.id
    ) lines
    WHERE ${onStoreDays(r, filter)}
    UNION ALL
    SELECT d.org_id, d.store_id, d.branch_id, ${accraDay(d)}, ${accraHour(d)}, NULL::uuid,
      (d.source = 'order')::int, d.items, d.gross, d.discount, d.tax, d.vat, d.nhil, d.getfund, d.covid, d.net, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0
    FROM (${onlineDocuments(filter, "sale")}) d
    UNION ALL
    SELECT d.org_id, d.store_id, d.branch_id, ${accraDay(d)}, ${accraHour(d)}, NULL::uuid,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      1, d.gross, d.tax, d.vat, d.nhil, d.getfund, d.covid, d.net, 0
    FROM (${onlineDocuments(filter, "refund")}) d
  ) x
  GROUP BY org_id, store_id, branch_id, day, hour, cashier_id`;

const d = sql`d`;
const o = sql`o`;

/**
 * An online order's sales or refunds, one row per document (the paid order, the change its picking made, a refund),
 * summed from its report lines. Only the paid order counts as a sale; the delivery fee is money, not an item.
 */
const onlineDocuments = (filter: FoldFilter, kind: "sale" | "refund") => sql`
  SELECT o.org_id, o.store_id, o.branch_id, o.occurred_at, o.source,
    coalesce(sum((o.tax->>'quantityThousandths')::bigint) FILTER (WHERE o.product_id IS NOT NULL), 0) AS items,
    sum((o.tax->>'gross')::bigint) AS gross, sum(coalesce((o.tax->>'discount')::bigint, 0)) AS discount,
    sum(${taxSum("o.tax")}) AS tax,
    ${sql.raw(levies.map((levy) => `sum((o.tax->>'${levy}')::bigint) AS ${levy}`).join(", "))},
    sum((o.tax->>'base')::bigint) AS net
  FROM order_report_line o
  WHERE ${onStoreDays(o, filter)} AND o.kind = ${kind}
  GROUP BY o.org_id, o.store_id, o.branch_id, o.order_id, o.occurred_at, o.source`;
