import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { product, stockMovement } from "@shopper/db-pg";
import { add, money, mulQty, type Money } from "@shopper/money";
import { productStockQuery } from "../schemas/stock/views";
import type { Queryable } from "../types";
import { onHandOf } from "./onhand";
import { requireBranch } from "./queries";

/** The unit cost of each product's latest costed receipt at a branch. */
export async function lastCosts(db: Queryable, orgId: string, branchId: string) {
  const rows = await db
    .selectDistinctOn([stockMovement.productId], {
      productId: stockMovement.productId,
      unitCost: stockMovement.unitCost,
    })
    .from(stockMovement)
    .where(
      and(
        eq(stockMovement.orgId, orgId),
        eq(stockMovement.branchId, branchId),
        sql`${stockMovement.unitCost} IS NOT NULL`,
      ),
    )
    .orderBy(
      stockMovement.productId,
      sql`${stockMovement.occurredAt} DESC`,
      sql`${stockMovement.id} DESC`,
    );
  return new Map(rows.map((row) => [row.productId, row.unitCost!]));
}

/**
 * Stock at a branch valued at on hand times the last received unit cost. Stock at or below zero is
 * worth 0, and flagged when negative or when no costed receipt exists. Products with nothing on hand are left out; archived ones with stock stay in.
 */
export async function stockValuation(db: Queryable, orgId: string, rawQuery: unknown) {
  const { branchId } = v.parse(productStockQuery, rawQuery);
  await requireBranch(db, orgId, branchId);
  const costs = await lastCosts(db, orgId, branchId);
  const rows = await db
    .select({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      onHandThousandths: onHandOf(orgId, branchId, product.id),
    })
    .from(product)
    .where(eq(product.orgId, orgId))
    .orderBy(product.name, product.id);
  const lines = rows
    .filter((row) => row.onHandThousandths !== 0)
    .map((row) => {
      const unitCost: Money | null = costs.get(row.productId) ?? null;
      const flag =
        row.onHandThousandths < 0
          ? ("negative" as const)
          : unitCost === null
            ? ("no_cost" as const)
            : null;
      const value =
        unitCost !== null && row.onHandThousandths > 0
          ? mulQty(unitCost, row.onHandThousandths)
          : money(0);
      return { ...row, unitCost, value, flag };
    });
  return { lines, total: lines.reduce((sum, line) => add(sum, line.value), money(0)) };
}
