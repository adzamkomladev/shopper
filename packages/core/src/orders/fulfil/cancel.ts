import { defineCommand } from "@shopper/audit";
import { move } from "../flow";
import { releaseOrderHolds } from "../holds";
import { recordStatus } from "./events";

/**
 * The shopper cancels an order they have not paid for: it is cancelled and the stock it held goes back at once. Its
 * workflow ends by itself when the hold would have run out. A paid order is the store's to cancel (a refund).
 */
export const cancelPlacedOrder = defineCommand({
  name: "order.cancelled",
  async run(tx, ctx, input: { id: string }) {
    const moved = await move(tx, ctx.orgId, input.id, "placed", "cancelled");
    if (!moved) return { moved, released: 0 };
    const now = new Date();
    await recordStatus(tx, ctx, input.id, "cancelled", now);
    return { moved, released: await releaseOrderHolds(tx, ctx.orgId, input.id, "cancelled", now) };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/**
 * On a box, a relayed order (v1.5 Day 50) ends refunded: the shop cancelled it, or the relay refunded it (not picked
 * or collected in time). The stock it held goes back; the relay owns the money, and hears of a box cancel on the
 * Publisher's next run. Ending one already refunded changes nothing.
 */
export const cancelRelayedOrder = defineCommand({
  name: "relay.order.cancelled",
  async run(tx, ctx, input: { id: string }) {
    const moved = await move(
      tx,
      ctx.orgId,
      input.id,
      ["paid", "accepted", "picking", "ready", "out_for_delivery"],
      "refunded",
    );
    if (!moved) return { moved, released: 0 };
    const now = new Date();
    await recordStatus(tx, ctx, input.id, "refunded", now);
    return { moved, released: await releaseOrderHolds(tx, ctx.orgId, input.id, "cancelled", now) };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
