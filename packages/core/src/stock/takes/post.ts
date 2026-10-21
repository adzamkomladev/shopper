import { and, eq, sql } from "drizzle-orm";
import { canonicalJson, defineCommand } from "@shopper/audit";
import { stockDocument, stockMovement, stockTake, stockTakeLine } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { countDeltas } from "../counts";
import { StockError } from "../error";
import { checkReorder } from "../reorder";
import { lockOpenTake } from "./lock";

/**
 * Posts a counted take as one count document (its id is the take's): each line moves counted minus
 * on hand at that line's own countedAt, dated there, so sales after the count stay after it.
 */
export const postTake = defineCommand({
  name: "stock.take.post",
  async run(tx, ctx, input: { takeId: string; now: Date }) {
    const take = await lockOpenTake(tx, ctx, input.takeId);
    const lines = await tx
      .select()
      .from(stockTakeLine)
      .where(and(eq(stockTakeLine.orgId, ctx.orgId), eq(stockTakeLine.takeId, take.id)));
    const counted = lines.flatMap((line) =>
      line.countedThousandths === null || line.countedAt === null
        ? []
        : [
            {
              productId: line.productId,
              countedThousandths: line.countedThousandths,
              at: line.countedAt,
            },
          ],
    );
    if (counted.length < lines.length) {
      const left = lines.length - counted.length;
      throw new StockError(
        "NOT_COUNTED",
        `${left} ${left === 1 ? "product" : "products"} not counted yet`,
      );
    }
    const deltas = await countDeltas(tx, ctx.orgId, take.branchId, counted);
    const request = {
      takeId: take.id,
      lines: counted.map(({ productId, countedThousandths }) => ({
        productId,
        countedThousandths,
      })),
    };
    await tx.insert(stockDocument).values({
      id: take.id,
      orgId: ctx.orgId,
      branchId: take.branchId,
      actorId: ctx.actorId!,
      kind: "count",
      occurredAt: input.now,
      contentHash: await sha256(canonicalJson(request)),
      payload: { lines: counted.map((line) => ({ ...line, at: line.at.toISOString() })) },
    });
    const moves = counted.filter((line) => deltas.get(line.productId) !== 0);
    if (moves.length)
      await tx.insert(stockMovement).values(
        moves.map((line) => ({
          orgId: ctx.orgId,
          branchId: take.branchId,
          productId: line.productId,
          documentId: take.id,
          reason: "count" as const,
          quantityThousandths: deltas.get(line.productId)!,
          occurredAt: line.at,
        })),
      );
    const expected = JSON.stringify(
      counted.map((line) => ({
        product_id: line.productId,
        expected: line.countedThousandths - deltas.get(line.productId)!,
      })),
    );
    await tx.execute(sql`
      UPDATE stock_take_line AS l SET expected_thousandths = i.expected, updated_at = now()
      FROM jsonb_to_recordset(${expected}::jsonb) AS i(product_id uuid, expected bigint)
      WHERE l.org_id = ${ctx.orgId} AND l.take_id = ${take.id} AND l.product_id = i.product_id`);
    await tx
      .update(stockTake)
      .set({ status: "posted", closedBy: ctx.actorId, closedAt: input.now, updatedAt: new Date() })
      .where(and(eq(stockTake.orgId, ctx.orgId), eq(stockTake.id, take.id)));
    await checkReorder(
      tx,
      ctx,
      take.branchId,
      moves.map((line) => line.productId),
    );
    return {
      id: take.id,
      variances: moves.map((line) => ({
        productId: line.productId,
        delta: deltas.get(line.productId)!,
      })),
    };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "stock_take", entityId: output.id }),
});
