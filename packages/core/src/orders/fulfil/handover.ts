import { and, eq, isNull } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder, stockHold, stockMovement, type ShopperTransaction } from "@shopper/db-pg";
import { recordFiscalDoc } from "../../fiscal/documents";
import { receiptDocument } from "../../schemas/receipts/document";
import { releaseOrderHolds } from "../holds";
import { OrderError } from "../error";
import { readOrder } from "../flow";
import { recordStatus } from "./events";

const told = (orgId: string, orderId: string, status: string) => ({
  id: v7(),
  orgId,
  v: 1,
  sequence: "0",
  type: "order.status",
  payload: { orderId, status },
});

/** A delivery leaves the shop. */
export const dispatchOrder = defineCommand({
  name: "order.dispatched",
  async run(tx, ctx, input: { id: string }) {
    const order = await readOrder(tx, ctx.orgId, input.id);
    if (order.status !== "ready" || order.fulfilment !== "delivery")
      throw new OrderError("conflict", "This order is not waiting to be sent out.");
    const now = new Date();
    await tx
      .update(onlineOrder)
      .set({ status: "out_for_delivery", updatedAt: now })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
    await recordStatus(tx, ctx, order.id, "out_for_delivery", now);
    enqueueAfterCommit(tx, told(ctx.orgId, order.id, "out_for_delivery"));
    return { id: order.id };
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** The shopper has their order: collected at the shop, or delivered. */
export const handOverOrder = defineCommand({
  name: "order.handed_over",
  async run(tx, ctx, input: { id: string }) {
    const order = await readOrder(tx, ctx.orgId, input.id);
    const waiting = order.fulfilment === "delivery" ? "out_for_delivery" : "ready";
    if (order.status !== waiting)
      throw new OrderError("conflict", "This order is not waiting to be handed over.");
    const now = new Date();
    await tx
      .update(onlineOrder)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
    await recordStatus(tx, ctx, order.id, "completed", now);
    if (order.channel === "relay") await sellHeld(tx, ctx.orgId, order, now);
    enqueueAfterCommit(tx, told(ctx.orgId, order.id, "completed"));
    return { id: order.id };
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/**
 * A relayed order on a box (v1.5 Day 50) held its stock from acceptance; at hand-over the goods leave the shelf. The
 * relay took the money; the box fiscalises the invoice the relay issued, over its own E-VAT link (Day 51).
 */
async function sellHeld(
  tx: ShopperTransaction,
  orgId: string,
  order: typeof onlineOrder.$inferSelect,
  now: Date,
) {
  const held = await tx
    .select()
    .from(stockHold)
    .where(
      and(
        eq(stockHold.orgId, orgId),
        eq(stockHold.orderId, order.id),
        isNull(stockHold.releasedAt),
      ),
    );
  if (held.length)
    await tx.insert(stockMovement).values(
      held.map((hold) => ({
        orgId,
        branchId: hold.branchId,
        productId: hold.productId,
        orderId: order.id,
        reason: "sale" as const,
        quantityThousandths: -hold.quantityThousandths,
        occurredAt: now,
      })),
    );
  await releaseOrderHolds(tx, orgId, order.id, "fulfilled", now);
  if (order.receipt)
    await recordFiscalDoc(tx, orgId, v.parse(receiptDocument, order.receipt), {
      storeId: order.storeId,
      branchId: order.branchId,
      orderId: order.id,
    });
}
