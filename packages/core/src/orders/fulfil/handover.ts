import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder } from "@shopper/db-pg";
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
    enqueueAfterCommit(tx, told(ctx.orgId, order.id, "completed"));
    return { id: order.id };
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
