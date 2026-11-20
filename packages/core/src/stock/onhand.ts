import { and, eq, sql } from "drizzle-orm";
import { onlineAvailability, stockHold, stockMovement } from "@shopper/db-pg";
import type { Queryable } from "../types";

/** The signed movement total of the product's row in the outer query; the one definition of on hand. */
export const onHandOf = (orgId: string, branchId: string, productId: unknown) =>
  sql<number>`COALESCE((SELECT SUM(${stockMovement.quantityThousandths}) FROM ${stockMovement} WHERE ${and(
    eq(stockMovement.orgId, orgId),
    eq(stockMovement.branchId, branchId),
    sql`${stockMovement.productId} = ${productId}`,
  )}), 0)::bigint`.mapWith(Number);

/**
 * What the online store may still sell: on hand (on a relay org, what its box last published) less every hold that is
 * neither released nor past its expiry, so a late release never keeps a unit off sale. The one definition of available.
 * On a relay org an order's sale leaves the shelf at payment until its box has taken the order (Day 50); from then
 * the box's published figure carries it, so those movements no longer count.
 */
export const availableOf = (orgId: string, branchId: string, productId: unknown, at: Date) =>
  sql<number>`(${onHandOf(orgId, branchId, productId)} - COALESCE((SELECT SUM(m.quantity_thousandths) FROM stock_movement m JOIN online_order o ON o.org_id = m.org_id AND o.id = m.order_id WHERE ${and(
    sql`m.org_id = ${orgId}`,
    sql`m.branch_id = ${branchId}`,
    sql`m.product_id = ${productId}`,
    sql`o.relay_acked_at IS NOT NULL`,
  )}), 0) + COALESCE((SELECT ${onlineAvailability.quantityThousandths} FROM ${onlineAvailability} WHERE ${and(
    eq(onlineAvailability.orgId, orgId),
    eq(onlineAvailability.branchId, branchId),
    sql`${onlineAvailability.productId} = ${productId}`,
  )}), 0) - COALESCE((SELECT SUM(${stockHold.quantityThousandths}) FROM ${stockHold} WHERE ${and(
    eq(stockHold.orgId, orgId),
    eq(stockHold.branchId, branchId),
    sql`${stockHold.productId} = ${productId}`,
    sql`${stockHold.releasedAt} IS NULL`,
    sql`${stockHold.expiresAt} > ${at}`,
  )}), 0))::bigint`.mapWith(Number);

/**
 * On hand per product at a branch: the sum of its movements, or only those up to `at` when given.
 * Products without movements read 0.
 */
export async function onHand(
  db: Queryable,
  orgId: string,
  branchId: string,
  items: { productId: string; at?: Date }[],
) {
  const totals = new Map(items.map((item) => [item.productId, 0]));
  if (!items.length) return totals;
  const rows = items.map(({ productId, at }) => ({ product_id: productId, at: at ?? null }));
  const { rows: sums } = await db.execute<{ product_id: string; total: string }>(sql`
    SELECT i.product_id, COALESCE(SUM(m.quantity_thousandths), 0) AS total
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS i(product_id uuid, at timestamptz)
    LEFT JOIN stock_movement m
      ON m.org_id = ${orgId} AND m.branch_id = ${branchId} AND m.product_id = i.product_id
      AND (i.at IS NULL OR m.occurred_at <= i.at)
    GROUP BY i.product_id`);
  for (const row of sums) totals.set(row.product_id, Number(row.total));
  return totals;
}
