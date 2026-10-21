import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { branch, category, stockTake } from "@shopper/db-pg";
import { takeCounts, takeStart, type TakeCounts, type TakeStart } from "../../schemas/stock/takes";
import { StockError } from "../error";
import { lockOpenTake } from "./lock";

type Output = { id: string; replayed?: boolean };
const details = (_input: unknown, output: Output) => ({
  entity: "stock_take",
  entityId: output.id,
});

type StartInput = { take: TakeStart };

/** Opens a count sheet with every active product (full) or those of one category. */
export const startTake = defineCommand({
  name: "stock.take.start",
  async replay(tx, ctx, input: StartInput) {
    const take = v.parse(takeStart, input.take);
    const [saved] = await tx
      .select()
      .from(stockTake)
      .where(and(eq(stockTake.orgId, ctx.orgId), eq(stockTake.id, take.id)));
    if (!saved) return undefined;
    if (
      saved.branchId !== take.branchId ||
      saved.scope !== take.scope ||
      (saved.categoryId ?? undefined) !== take.categoryId
    )
      throw new StockError("CONFLICT", "Stock take identity already has different content");
    return { output: { id: saved.id, replayed: true } };
  },
  async run(tx, ctx, input: StartInput): Promise<Output> {
    const take = v.parse(takeStart, input.take);
    const [site] = await tx
      .select({ id: branch.id })
      .from(branch)
      .where(and(eq(branch.orgId, ctx.orgId), eq(branch.id, take.branchId)));
    if (!site || (ctx.deviceId && take.branchId !== ctx.branchId))
      throw new StockError("INVALID_REFERENCE", "Unknown branch");
    if (take.categoryId) {
      const [known] = await tx
        .select({ id: category.id })
        .from(category)
        .where(and(eq(category.orgId, ctx.orgId), eq(category.id, take.categoryId)));
      if (!known) throw new StockError("INVALID_REFERENCE", "Unknown category");
    }
    const [open] = await tx
      .select({ id: stockTake.id })
      .from(stockTake)
      .where(
        and(
          eq(stockTake.orgId, ctx.orgId),
          eq(stockTake.branchId, take.branchId),
          eq(stockTake.status, "open"),
        ),
      );
    if (open) throw new StockError("TAKE_OPEN", "This branch already has an open stock take");
    await tx.insert(stockTake).values({
      id: take.id,
      orgId: ctx.orgId,
      branchId: take.branchId,
      scope: take.scope,
      categoryId: take.categoryId,
      startedBy: ctx.actorId!,
    });
    const snapshot = await tx.execute(sql`
      INSERT INTO stock_take_line (org_id, take_id, product_id)
      SELECT org_id, ${take.id}, id FROM product
      WHERE org_id = ${ctx.orgId} AND archived_at IS NULL
        AND (${take.categoryId ?? null}::uuid IS NULL OR category_id = ${take.categoryId ?? null}::uuid)`);
    if (!snapshot.rowCount)
      throw new StockError("INVALID_REFERENCE", "There are no products to count");
    return { id: take.id };
  },
  audit: (input) => ({ ...v.parse(takeStart, input.take) }),
  details,
});

type CountInput = { takeId: string; counts: TakeCounts; now: Date };

/** Records counts on the sheet; a recount replaces the count, its time and who counted. */
export const countTake = defineCommand({
  name: "stock.take.count",
  async run(tx, ctx, input: CountInput): Promise<Output> {
    const { lines } = v.parse(takeCounts, input.counts);
    await lockOpenTake(tx, ctx, input.takeId);
    const rows = JSON.stringify(
      lines.map((line) => ({ product_id: line.productId, counted: line.countedThousandths })),
    );
    const updated = await tx.execute(sql`
      UPDATE stock_take_line AS l
      SET counted_thousandths = i.counted, counted_at = ${input.now}, counted_by = ${ctx.actorId}, updated_at = now()
      FROM jsonb_to_recordset(${rows}::jsonb) AS i(product_id uuid, counted bigint)
      WHERE l.org_id = ${ctx.orgId} AND l.take_id = ${input.takeId} AND l.product_id = i.product_id`);
    if (updated.rowCount !== lines.length)
      throw new StockError("INVALID_REFERENCE", "A counted product is not on this stock take");
    return { id: input.takeId };
  },
  audit: (input, output) => ({ id: output.id, counted: input.counts.lines.length }),
  details,
});

/** Closes an open take without posting anything. */
export const cancelTake = defineCommand({
  name: "stock.take.cancel",
  async run(tx, ctx, input: { takeId: string; now: Date }): Promise<Output> {
    await lockOpenTake(tx, ctx, input.takeId);
    await tx
      .update(stockTake)
      .set({
        status: "cancelled",
        closedBy: ctx.actorId,
        closedAt: input.now,
        updatedAt: new Date(),
      })
      .where(and(eq(stockTake.orgId, ctx.orgId), eq(stockTake.id, input.takeId)));
    return { id: input.takeId };
  },
  audit: (_input, output) => ({ id: output.id }),
  details,
});
