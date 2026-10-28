import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import {
  branch,
  reorderPoint,
  stockAlert,
  type ShopperTransaction,
  type stockAlertKinds,
} from "@shopper/db-pg";
import { reorderInput } from "../schemas/stock/alerts";
import { validateProducts } from "./authority";
import { StockError } from "./error";
import { onHand } from "./onhand";

/**
 * Keeps each product's one open alert in step with its on hand. Its kind is the worst condition: `negative`
 * under zero, for every product (two registers can sell the last unit offline), else `low` at or under its
 * reorder level; with neither it clears. A raise, or a change of kind, texts again (`sent_at` resets). The
 * partial unique index keeps one open alert per product, however many writers see the crossing; writers from
 * before kinds existed keep raising and clearing low alerts against the same index.
 */
export async function checkStockAlerts(
  tx: ShopperTransaction,
  ctx: CommandContext,
  branchId: string,
  productIds: string[],
) {
  if (!productIds.length) return;
  const levels = new Map(
    (
      await tx
        .select()
        .from(reorderPoint)
        .where(
          and(
            eq(reorderPoint.orgId, ctx.orgId),
            eq(reorderPoint.branchId, branchId),
            inArray(reorderPoint.productId, productIds),
          ),
        )
    ).map((level) => [level.productId, level.levelThousandths]),
  );
  const unique = [...new Set(productIds)];
  const totals = await onHand(
    tx,
    ctx.orgId,
    branchId,
    unique.map((productId) => ({ productId })),
  );
  // Read first: a product that stays low or negative writes nothing, so concurrent sales of it take no lock.
  const open = new Map(
    (
      await tx
        .select({ id: stockAlert.id, productId: stockAlert.productId, kind: stockAlert.kind })
        .from(stockAlert)
        .where(
          and(
            eq(stockAlert.orgId, ctx.orgId),
            eq(stockAlert.branchId, branchId),
            inArray(stockAlert.productId, unique),
            isNull(stockAlert.clearedAt),
          ),
        )
    ).map((alert) => [alert.productId, alert]),
  );
  for (const productId of unique) {
    const current = totals.get(productId)!;
    const level = levels.get(productId);
    const kind: (typeof stockAlertKinds)[number] | undefined =
      current < 0 ? "negative" : level !== undefined && current <= level ? "low" : undefined;
    const existing = open.get(productId);
    if (existing?.kind === kind) continue;
    if (!kind) {
      await clearAlert(tx, ctx.orgId, existing!.id);
      continue;
    }
    const values = { kind, levelThousandths: level ?? 0, onHandThousandths: current };
    const [raised] = existing
      ? await tx
          .update(stockAlert)
          .set({ ...values, sentAt: null, updatedAt: sql`now()` })
          .where(
            and(
              eq(stockAlert.orgId, ctx.orgId),
              eq(stockAlert.id, existing.id),
              isNull(stockAlert.clearedAt),
              sql`${stockAlert.kind} <> ${kind}`,
            ),
          )
          .returning({ id: stockAlert.id })
      : await tx
          .insert(stockAlert)
          .values({ orgId: ctx.orgId, branchId, productId, ...values })
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
        type: `stock.${kind}`,
        payload: { alertId: raised.id, kind },
      });
  }
}

async function clearAlert(tx: ShopperTransaction, orgId: string, alertId: string) {
  await tx
    .update(stockAlert)
    .set({ clearedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(eq(stockAlert.orgId, orgId), eq(stockAlert.id, alertId), isNull(stockAlert.clearedAt)),
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
      await checkStockAlerts(tx, ctx, branchId, [productId]);
    } else {
      await tx
        .insert(reorderPoint)
        .values({ orgId: ctx.orgId, branchId, productId, levelThousandths })
        .onConflictDoUpdate({
          target: [reorderPoint.orgId, reorderPoint.branchId, reorderPoint.productId],
          set: { levelThousandths, updatedAt: new Date() },
        });
      await checkStockAlerts(tx, ctx, branchId, [productId]);
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
