import { and, eq, inArray, isNull, lte, min, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { product, stockHold, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { availableOf } from "../stock/onhand";

type Line = { productId: string; quantityThousandths: number };

/**
 * Inside a command's transaction: holds every line at the branch until `expiresAt`, or nothing. A line is short when
 * the branch has less available than it asks for. The command's org lock serializes this with till sales, so two
 * checkouts never both take the last unit.
 */
export async function reserveStock(
  tx: ShopperTransaction,
  orgId: string,
  input: { branchId: string; orderId: string; lines: Line[]; expiresAt: Date; now: Date },
) {
  const wanted = new Map<string, number>();
  for (const line of input.lines)
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantityThousandths);
  const rows = await tx
    .select({
      id: product.id,
      available: availableOf(orgId, input.branchId, product.id, input.now),
    })
    .from(product)
    .where(and(eq(product.orgId, orgId), inArray(product.id, [...wanted.keys()])));
  const available = new Map(rows.map((row) => [row.id, row.available]));
  const short = [...wanted].flatMap(([id, quantity]) =>
    (available.get(id) ?? 0) < quantity ? [id] : [],
  );
  if (short.length) return { short };
  await tx.insert(stockHold).values(
    [...wanted].map(([productId, quantityThousandths]) => ({
      orgId,
      branchId: input.branchId,
      productId,
      orderId: input.orderId,
      quantityThousandths,
      expiresAt: input.expiresAt,
    })),
  );
  return { short };
}

/** Inside a command's transaction: gives back what an order still holds. Releasing twice changes nothing. */
export async function releaseOrderHolds(
  tx: ShopperTransaction,
  orgId: string,
  orderId: string,
  reason: "expired" | "cancelled" | "fulfilled",
  now: Date,
) {
  const released = await tx
    .update(stockHold)
    .set({ releasedAt: now, releaseReason: reason, updatedAt: now })
    .where(
      and(eq(stockHold.orgId, orgId), eq(stockHold.orderId, orderId), isNull(stockHold.releasedAt)),
    )
    .returning({ id: stockHold.id });
  return released.length;
}

/**
 * The StockHold alarm: releases every hold at the branch whose time is up and says when the next one is, so the
 * coordinator arms itself for it (null: nothing left to watch).
 */
export const releaseExpiredHolds = defineCommand({
  name: "stock.holds_expired",
  async run(tx, context, input: { branchId: string; now: Date }) {
    const scope = and(
      eq(stockHold.orgId, context.orgId),
      eq(stockHold.branchId, input.branchId),
      isNull(stockHold.releasedAt),
    );
    const released = await tx
      .update(stockHold)
      .set({ releasedAt: input.now, releaseReason: "expired", updatedAt: input.now })
      .where(and(scope, lte(stockHold.expiresAt, input.now)))
      .returning({ id: stockHold.id, orderId: stockHold.orderId });
    const [next] = await tx
      .select({ at: min(stockHold.expiresAt) })
      .from(stockHold)
      .where(scope);
    return { released: released.length, next: next?.at ? next.at.toISOString() : null };
  },
  audit: (input, output) => ({ branchId: input.branchId, ...output }),
});

/** Every branch still holding stock and its next expiry: what a box re-arms after a restart. */
export async function heldBranches(db: ShopperDatabase) {
  return db
    .select({
      orgId: stockHold.orgId,
      branchId: stockHold.branchId,
      next: sql<Date>`min(${stockHold.expiresAt})`.mapWith((value) => new Date(value)),
    })
    .from(stockHold)
    .where(isNull(stockHold.releasedAt))
    .groupBy(stockHold.orgId, stockHold.branchId);
}
