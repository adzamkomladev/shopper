import * as v from "valibot";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { branch, category, product, stockTake, stockTakeLine, user } from "@shopper/db-pg";
import { mulQty } from "@shopper/money";
import { uuidV7Schema } from "@shopper/ports";
import { takesQuery } from "../../schemas/stock/takes";
import type { Queryable } from "../../types";
import { StockError } from "../error";
import { onHand } from "../onhand";
import { requireBranch } from "../queries";
import { lastCosts } from "../valuation";

const iso = (date: Date | null) => date?.toISOString() ?? null;

const selectTakes = (db: Queryable) =>
  db
    .select({
      id: stockTake.id,
      branchId: stockTake.branchId,
      branchName: branch.name,
      scope: stockTake.scope,
      categoryId: stockTake.categoryId,
      categoryName: category.name,
      status: stockTake.status,
      startedBy: stockTake.startedBy,
      startedByName: user.name,
      startedAt: stockTake.createdAt,
      closedAt: stockTake.closedAt,
      lines:
        sql<number>`(SELECT count(*) FROM ${stockTakeLine} l WHERE l.org_id = ${stockTake.orgId} AND l.take_id = ${stockTake.id})`.mapWith(
          Number,
        ),
      uncounted:
        sql<number>`(SELECT count(*) FROM ${stockTakeLine} l WHERE l.org_id = ${stockTake.orgId} AND l.take_id = ${stockTake.id} AND l.counted_at IS NULL)`.mapWith(
          Number,
        ),
    })
    .from(stockTake)
    .innerJoin(branch, and(eq(branch.orgId, stockTake.orgId), eq(branch.id, stockTake.branchId)))
    .innerJoin(user, and(eq(user.orgId, stockTake.orgId), eq(user.id, stockTake.startedBy)))
    .leftJoin(
      category,
      and(eq(category.orgId, stockTake.orgId), eq(category.id, stockTake.categoryId)),
    );
const summary = <T extends { startedAt: Date; closedAt: Date | null }>(row: T) => ({
  ...row,
  startedAt: row.startedAt.toISOString(),
  closedAt: iso(row.closedAt),
});

/** Stock takes, newest first, keyset-paged by id; limited to `scope` (the caller's branches) when given. */
export async function listTakes(db: Queryable, orgId: string, rawQuery: unknown, scope?: string[]) {
  const { branchId, status, cursor, limit } = v.parse(takesQuery, rawQuery);
  if (branchId) await requireBranch(db, orgId, branchId);
  const rows = await selectTakes(db)
    .where(
      and(
        eq(stockTake.orgId, orgId),
        branchId ? eq(stockTake.branchId, branchId) : undefined,
        scope ? inArray(stockTake.branchId, scope) : undefined,
        status ? eq(stockTake.status, status) : undefined,
        cursor ? lt(stockTake.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(stockTake.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(summary);
  return { items, nextCursor: rows.length > limit ? items[limit - 1]!.id : null };
}

/**
 * A take with its sheet. Open, expected is on hand at the line's countedAt (now when uncounted) and
 * moves with late sales; posted, the stored expected is shown. Value is variance at the last cost.
 */
export async function readTake(db: Queryable, orgId: string, id: string, scope?: string[]) {
  if (!v.is(uuidV7Schema, id)) throw new StockError("INVALID_REFERENCE", "Invalid stock take id");
  const [head] = await selectTakes(db).where(
    and(
      eq(stockTake.orgId, orgId),
      eq(stockTake.id, id),
      scope ? inArray(stockTake.branchId, scope) : undefined,
    ),
  );
  if (!head) throw new StockError("NOT_FOUND", "Stock take not found");
  const rows = await db
    .select({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      baseUnit: product.baseUnit,
      countedThousandths: stockTakeLine.countedThousandths,
      countedAt: stockTakeLine.countedAt,
      countedBy: stockTakeLine.countedBy,
      stored: stockTakeLine.expectedThousandths,
    })
    .from(stockTakeLine)
    .innerJoin(
      product,
      and(eq(product.orgId, stockTakeLine.orgId), eq(product.id, stockTakeLine.productId)),
    )
    .where(and(eq(stockTakeLine.orgId, orgId), eq(stockTakeLine.takeId, id)))
    .orderBy(asc(product.name), asc(product.id));
  const live = head.status === "open";
  const [current, costs] = await Promise.all([
    live
      ? onHand(
          db,
          orgId,
          head.branchId,
          rows.map((row) => ({ productId: row.productId, at: row.countedAt ?? undefined })),
        )
      : undefined,
    lastCosts(db, orgId, head.branchId),
  ]);
  const lines = rows.map(({ stored, countedAt, ...row }) => {
    const expected = live ? current!.get(row.productId)! : stored;
    const variance =
      row.countedThousandths !== null && expected !== null
        ? row.countedThousandths - expected
        : null;
    const cost = costs.get(row.productId);
    return {
      ...row,
      countedAt: iso(countedAt),
      expectedThousandths: expected,
      varianceThousandths: variance,
      unitCost: cost ?? null,
      varianceValue: variance !== null && cost !== undefined ? mulQty(cost, variance) : null,
    };
  });
  return { ...summary(head), lines: lines };
}
