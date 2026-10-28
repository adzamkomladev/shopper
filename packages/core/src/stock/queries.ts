import * as v from "valibot";
import { type SQL, and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { branch, product, productBarcode, reorderPoint, stockMovement } from "@shopper/db-pg";
import { productStockQuery, stockQuery } from "../schemas/stock/views";
import type { Queryable } from "../types";
import { StockError } from "./error";
import { onHandOf } from "./onhand";

const MOVEMENT_LIMIT = 200;
const notFound = (what: string) => new StockError("NOT_FOUND", `${what} not found`);
export const iso = <T extends { occurredAt: Date }>(row: T) => ({
  ...row,
  occurredAt: row.occurredAt.toISOString(),
});
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export async function requireBranch(db: Queryable, orgId: string, branchId: string) {
  const [found] = await db
    .select({ id: branch.id })
    .from(branch)
    .where(and(eq(branch.orgId, orgId), eq(branch.id, branchId)));
  if (!found) throw notFound("Branch");
}

export async function stockBranches(db: Queryable, orgId: string, scope?: string[]) {
  const rows = await db
    .select({ id: branch.id, name: branch.name })
    .from(branch)
    .where(and(eq(branch.orgId, orgId), scope ? inArray(branch.id, scope) : undefined))
    .orderBy(asc(branch.name), asc(branch.id));
  return { branches: rows };
}

/** One row per product, with on hand folded from the ledger and the branch's reorder level. */
function stockRows(db: Queryable, orgId: string, branchId: string) {
  const onHand = onHandOf(orgId, branchId, product.id);
  return {
    onHand,
    select: db
      .select({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        baseUnit: product.baseUnit,
        categoryId: product.categoryId,
        onHandThousandths: onHand,
        levelThousandths: reorderPoint.levelThousandths,
      })
      .from(product)
      .leftJoin(
        reorderPoint,
        and(
          eq(reorderPoint.orgId, product.orgId),
          eq(reorderPoint.productId, product.id),
          eq(reorderPoint.branchId, branchId),
        ),
      ),
  };
}
const withFlags = <T extends { onHandThousandths: number; levelThousandths: number | null }>(
  row: T,
) => ({
  ...row,
  low: row.levelThousandths !== null && row.onHandThousandths <= row.levelThousandths,
  negative: row.onHandThousandths < 0,
});

/**
 * Active products of a branch, newest id first, keyset-paged; `low` keeps those at or under their reorder
 * level, `negative` those under zero.
 */
export async function listStock(db: Queryable, orgId: string, rawQuery: unknown) {
  const { branchId, q, categoryId, low, negative, cursor, limit } = v.parse(stockQuery, rawQuery);
  await requireBranch(db, orgId, branchId);
  const { onHand, select } = stockRows(db, orgId, branchId);
  const filters: (SQL | undefined)[] = [
    eq(product.orgId, orgId),
    isNull(product.archivedAt),
    categoryId ? eq(product.categoryId, categoryId) : undefined,
    cursor ? lt(product.id, cursor) : undefined,
    low ? sql`${onHand} <= ${reorderPoint.levelThousandths}` : undefined,
    negative ? sql`${onHand} < 0` : undefined,
    q
      ? or(
          ilike(product.name, like(q)),
          eq(product.sku, q),
          sql`exists (select 1 from ${productBarcode} where ${productBarcode.orgId} = ${product.orgId} and ${productBarcode.productId} = ${product.id} and ${productBarcode.code} = ${q})`,
        )
      : undefined,
  ];
  const rows = await select
    .where(and(...filters))
    .orderBy(desc(product.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(withFlags);
  return { items, nextCursor: rows.length > limit ? items[limit - 1]!.productId : null };
}

/** A product's stock at a branch with its movements newest first; each carries the balance after it. */
// ponytail: the newest MOVEMENT_LIMIT movements only; add a cursor when a product's history outgrows it.
export async function readStockProduct(
  db: Queryable,
  orgId: string,
  productId: string,
  rawQuery: unknown,
) {
  const { branchId } = v.parse(productStockQuery, rawQuery);
  await requireBranch(db, orgId, branchId);
  const [item] = await stockRows(db, orgId, branchId).select.where(
    and(eq(product.orgId, orgId), eq(product.id, productId), isNull(product.archivedAt)),
  );
  if (!item) throw notFound("Product");
  const balance = sql<number>`SUM(${stockMovement.quantityThousandths}) OVER (ORDER BY ${stockMovement.occurredAt}, ${stockMovement.id})::bigint`;
  const ledger = db
    .select({
      id: stockMovement.id,
      reason: stockMovement.reason,
      quantityThousandths: stockMovement.quantityThousandths,
      balanceThousandths: balance.mapWith(Number).as("balance"),
      unitCost: stockMovement.unitCost,
      documentId: stockMovement.documentId,
      saleId: stockMovement.saleId,
      refundId: stockMovement.refundId,
      occurredAt: stockMovement.occurredAt,
    })
    .from(stockMovement)
    .where(
      and(
        eq(stockMovement.orgId, orgId),
        eq(stockMovement.branchId, branchId),
        eq(stockMovement.productId, productId),
      ),
    )
    .as("ledger");
  const movements = await db
    .select()
    .from(ledger)
    .orderBy(desc(ledger.occurredAt), desc(ledger.id))
    .limit(MOVEMENT_LIMIT + 1);
  return {
    ...withFlags(item),
    movements: movements.slice(0, MOVEMENT_LIMIT).map(iso),
    truncated: movements.length > MOVEMENT_LIMIT,
  };
}
