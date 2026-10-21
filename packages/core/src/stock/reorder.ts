import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { branch, reorderPoint, stockAlert, type ShopperTransaction } from "@shopper/db-pg";
import { reorderInput } from "../schemas/stock/alerts";
import { validateProducts } from "./authority";
import { StockError } from "./error";
import { onHand } from "./onhand";

/**
 * Raises a low-stock alert for each product at or under its reorder level and clears the ones back
 * above it. The partial unique index makes a crossing raise once, however many writers see it.
 */
export async function checkReorder(
  tx: ShopperTransaction,
  ctx: CommandContext,
  branchId: string,
  productIds: string[],
) {
  if (!productIds.length) return;
  const levels = await tx
    .select()
    .from(reorderPoint)
    .where(
      and(
        eq(reorderPoint.orgId, ctx.orgId),
        eq(reorderPoint.branchId, branchId),
        inArray(reorderPoint.productId, productIds),
      ),
    );
  if (!levels.length) return;
  const totals = await onHand(
    tx,
    ctx.orgId,
    branchId,
    levels.map((level) => ({ productId: level.productId })),
  );
  const recovered: string[] = [];
  for (const level of levels) {
    const current = totals.get(level.productId)!;
    if (current > level.levelThousandths) {
      recovered.push(level.productId);
      continue;
    }
    const [raised] = await tx
      .insert(stockAlert)
      .values({
        orgId: ctx.orgId,
        branchId,
        productId: level.productId,
        levelThousandths: level.levelThousandths,
        onHandThousandths: current,
      })
      .onConflictDoNothing({
        target: [stockAlert.orgId, stockAlert.branchId, stockAlert.productId],
        where: isNull(stockAlert.clearedAt),
      })
      .returning({ id: stockAlert.id });
    // Alerts are not store-sequenced; consumers read the row, not the order.
    if (raised)
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "stock.low",
        payload: { alertId: raised.id },
      });
  }
  await clearAlerts(tx, ctx.orgId, branchId, recovered);
}

async function clearAlerts(
  tx: ShopperTransaction,
  orgId: string,
  branchId: string,
  productIds: string[],
) {
  if (!productIds.length) return;
  await tx
    .update(stockAlert)
    .set({ clearedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(stockAlert.orgId, orgId),
        eq(stockAlert.branchId, branchId),
        inArray(stockAlert.productId, productIds),
        isNull(stockAlert.clearedAt),
      ),
    );
}

/** Sets a product's reorder level at a branch, or removes it; the alert follows at once. */
export const setReorder = defineCommand({
  name: "stock.reorder.set",
  async run(tx, ctx, input: { reorder: unknown }) {
    const { branchId, productId, levelThousandths } = v.parse(reorderInput, input.reorder);
    const [site] = await tx
      .select({ id: branch.id })
      .from(branch)
      .where(and(eq(branch.orgId, ctx.orgId), eq(branch.id, branchId)));
    if (!site) throw new StockError("INVALID_REFERENCE", "Unknown branch");
    await validateProducts(tx, ctx.orgId, [productId]);
    if (levelThousandths === null) {
      await tx
        .delete(reorderPoint)
        .where(
          and(
            eq(reorderPoint.orgId, ctx.orgId),
            eq(reorderPoint.branchId, branchId),
            eq(reorderPoint.productId, productId),
          ),
        );
      await clearAlerts(tx, ctx.orgId, branchId, [productId]);
    } else {
      await tx
        .insert(reorderPoint)
        .values({ orgId: ctx.orgId, branchId, productId, levelThousandths })
        .onConflictDoUpdate({
          target: [reorderPoint.orgId, reorderPoint.branchId, reorderPoint.productId],
          set: { levelThousandths, updatedAt: new Date() },
        });
      await checkReorder(tx, ctx, branchId, [productId]);
    }
    return { branchId, productId, levelThousandths };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({
    entity: "reorder_point",
    entityId: output.productId,
    after: { branchId: output.branchId, levelThousandths: output.levelThousandths },
  }),
});
