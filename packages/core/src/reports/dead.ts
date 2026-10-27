import { sql } from "drizzle-orm";
import * as v from "valibot";
import { add, money, mulQty } from "@shopper/money";
import type { Queryable } from "../types";
import { deadStockQuery } from "../schemas/reports/query";
import { dayStart, inBranches } from "./days";
import { amount, count } from "./sums";

/**
 * Stock that is not selling: each branch's live products with stock on hand and no sale in the last 30, 60 or 90
 * days up to `on` (never sold counts too), valued at the latest costed receipt, most valuable first.
 */
export async function deadStock(
  db: Queryable,
  orgId: string,
  raw: unknown,
  scope?: string[],
  today = new Date().toISOString().slice(0, 10),
) {
  const query = v.parse(deadStockQuery, raw);
  const asOf = query.on ?? today;
  const branchIds = query.branchId ? [query.branchId] : scope;
  const since = dayStart(sql`(${asOf}::date - ${query.days - 1}::int)`);
  // The ledger as it stood at the end of `asOf`: nothing later moves its stock, last sale or cost.
  const until = dayStart(sql`(${asOf}::date + 1)`);
  const m = sql`m`;
  const { rows } = await db.execute<Record<string, string | null>>(sql`
    SELECT m.branch_id, b.name AS branch, m.product_id, p.sku, p.name,
      sum(m.quantity_thousandths)::text AS on_hand,
      to_char(max(m.occurred_at) FILTER (WHERE m.reason = 'sale') AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD') AS last_sale,
      (SELECT c.unit_cost FROM stock_movement c
        WHERE c.org_id = m.org_id AND c.branch_id = m.branch_id AND c.product_id = m.product_id
          AND c.reason = 'receipt' AND c.unit_cost IS NOT NULL AND c.occurred_at < ${until}
        ORDER BY c.occurred_at DESC, c.id DESC LIMIT 1)::text AS unit_cost
    FROM stock_movement m
    JOIN product p ON p.org_id = m.org_id AND p.id = m.product_id AND p.archived_at IS NULL
    JOIN branch b ON b.org_id = m.org_id AND b.id = m.branch_id
    WHERE m.org_id = ${orgId} AND m.occurred_at < ${until} ${inBranches(m, branchIds)}
    GROUP BY m.org_id, m.branch_id, b.name, m.product_id, p.sku, p.name
    HAVING sum(m.quantity_thousandths) > 0
      AND coalesce(max(m.occurred_at) FILTER (WHERE m.reason = 'sale') < ${since}, true)`);
  const lines = rows
    .map((row) => {
      const onHand = count(row.on_hand);
      const unitCost = row.unit_cost === null ? null : amount(row.unit_cost);
      return {
        branchId: row.branch_id!,
        branch: row.branch!,
        productId: row.product_id!,
        sku: row.sku!,
        name: row.name!,
        onHand,
        lastSale: row.last_sale,
        unitCost,
        value: unitCost === null ? money(0) : mulQty(unitCost, onHand),
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return {
    days: query.days,
    asOf,
    rows: lines,
    total: lines.reduce((sum, line) => add(sum, line.value), money(0)),
  };
}
