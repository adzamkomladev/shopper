import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder, org, stockHold, type ShopperTransaction } from "@shopper/db-pg";
import { recordStatus } from "./fulfil/events";
import { releaseOrderHolds } from "./holds";

type Input = { id: string };
type Status = (typeof onlineOrder.$inferSelect)["status"];

/** The workflow's first step: the order and the stock it holds, as placement left them. */
export const confirmHeld = defineCommand({
  name: "order.held",
  async run(tx, context, input: Input) {
    const order = await readOrder(tx, context.orgId, input.id);
    const [held] = await tx
      .select({ lines: count() })
      .from(stockHold)
      .where(
        and(
          eq(stockHold.orgId, context.orgId),
          eq(stockHold.orderId, input.id),
          isNull(stockHold.releasedAt),
        ),
      );
    return { holdExpiresAt: order.holdExpiresAt.toISOString(), lines: held?.lines ?? 0 };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** Nobody paid before the hold ran out: the order expires and gives its stock back. */
export const expireOrder = defineCommand({
  name: "order.expired",
  async run(tx, context, input: Input) {
    const moved = await move(tx, context.orgId, input.id, "placed", "expired");
    const released = await releaseOrderHolds(tx, context.orgId, input.id, "expired", new Date());
    return { moved, released };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/**
 * The workflow's checkpoint for a payment that kept the order. The payment's own transaction already paid and invoiced
 * it (stock out, books posted, hold given up); this only says whether the order stands paid.
 */
export const markOrderPaid = defineCommand({
  name: "order.paid",
  async run(tx, context, input: Input) {
    const order = await readOrder(tx, context.orgId, input.id);
    const [shop] = await tx.select({ mode: org.mode }).from(org).where(eq(org.id, context.orgId));
    return {
      paid: !["placed", "expired", "cancelled", "refunded"].includes(order.status),
      relay: shop?.mode === "relay",
      slotEnd: order.slotEnd.toISOString(),
    };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/**
 * A relay org's paid order its box has not accepted by the deadline (v1.5 Day 52): the shopper may now cancel it for a
 * full refund, and is texted so. Stamped once; an order the box took meanwhile is left alone.
 */
export const offerOrderCancel = defineCommand({
  name: "order.overdue",
  async run(tx, context, input: Input) {
    const [offered] = await tx
      .update(onlineOrder)
      .set({ overdueAt: new Date() })
      .where(
        and(
          eq(onlineOrder.orgId, context.orgId),
          eq(onlineOrder.id, input.id),
          eq(onlineOrder.status, "paid"),
          isNull(onlineOrder.overdueAt),
          // Past its slot there is nothing to wait for: the workflow refunds instead.
          gt(onlineOrder.slotEnd, sql`now()`),
        ),
      )
      .returning({ id: onlineOrder.id });
    if (offered)
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: context.orgId,
        v: 1,
        sequence: "0",
        type: "order.overdue",
        payload: { orderId: input.id },
      });
    // The slot as it stands now: the box may still take the order until it ends.
    return {
      offered: !!offered,
      slotEnd: (await readOrder(tx, context.orgId, input.id)).slotEnd.toISOString(),
    };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** The store took the paid order on. Accepting twice (the store's click, then the workflow's step) changes nothing. */
export const acceptOrder = defineCommand({
  name: "order.accepted",
  async run(tx, context, input: Input) {
    const moved = await move(tx, context.orgId, input.id, "paid", "accepted");
    if (moved) {
      const now = new Date();
      await tx
        .update(onlineOrder)
        .set({ acceptedAt: now })
        .where(and(eq(onlineOrder.orgId, context.orgId), eq(onlineOrder.id, input.id)));
      await recordStatus(tx, context, input.id, "accepted", now);
    }
    // The slot as it stands now, for the timers that follow acceptance.
    const order = await readOrder(tx, context.orgId, input.id);
    return {
      moved,
      slotStart: order.slotStart.toISOString(),
      slotEnd: order.slotEnd.toISOString(),
    };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

export async function readOrder(tx: ShopperTransaction, orgId: string, id: string) {
  const [order] = await tx
    .select()
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, id)));
  if (!order) throw new Error("Online order not found");
  return order;
}

/** Moves the order from one status to the next; false when it had already moved (a replayed step). */
export async function move(
  tx: ShopperTransaction,
  orgId: string,
  id: string,
  from: Status | Status[],
  to: Status,
) {
  const moved = await tx
    .update(onlineOrder)
    .set({ status: to, updatedAt: new Date() })
    .where(
      and(
        eq(onlineOrder.orgId, orgId),
        eq(onlineOrder.id, id),
        inArray(onlineOrder.status, Array.isArray(from) ? from : [from]),
      ),
    )
    .returning({ id: onlineOrder.id });
  return moved.length > 0;
}
