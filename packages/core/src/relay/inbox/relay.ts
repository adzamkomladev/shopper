import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { onlineOrder, onlineOrderLine, type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import { acceptStoreOrder, cancelStoreOrder, declineStoreOrder } from "../../orders/fulfil/actions";
import { recordStatus } from "../../orders/fulfil/events";
import { move } from "../../orders/flow";
import { relayOrderEvents } from "../../schemas/orders/relay";

const INBOX_PAGE = 100;
type Flows = Pick<WorkflowLauncher, "send">;
type Status = (typeof onlineOrder.$inferSelect)["status"];

/**
 * The relay's paid orders its box has not taken yet, oldest payment first (v1.5 Day 50). The box acknowledges an
 * order by telling the relay what it decided, so one lost on the way is offered again; the box takes it once.
 */
export async function relayInbox(db: ShopperDatabase, orgId: string) {
  const orders = await db
    .select()
    .from(onlineOrder)
    .where(
      and(
        eq(onlineOrder.orgId, orgId),
        eq(onlineOrder.status, "paid"),
        isNull(onlineOrder.relayAckedAt),
      ),
    )
    .orderBy(asc(onlineOrder.paidAt))
    .limit(INBOX_PAGE);
  const lines = orders.length
    ? await db
        .select()
        .from(onlineOrderLine)
        .where(
          and(
            eq(onlineOrderLine.orgId, orgId),
            inArray(
              onlineOrderLine.orderId,
              orders.map((order) => order.id),
            ),
          ),
        )
        .orderBy(asc(onlineOrderLine.position))
    : [];
  return {
    orders: orders.map((order) => ({
      id: order.id,
      storeId: order.storeId,
      branchId: order.branchId,
      inboxCursor: String(order.inboxCursor),
      fulfilment: order.fulfilment,
      slotStart: order.slotStart.toISOString(),
      slotEnd: order.slotEnd.toISOString(),
      deliveryAddress: order.deliveryAddress,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      email: order.email,
      base: order.base,
      vat: order.vat,
      nhil: order.nhil,
      getfund: order.getfund,
      covid: order.covid,
      gross: order.gross,
      receiptNumber: order.receiptNumber,
      receipt: order.receipt,
      paidAt: order.paidAt!.toISOString(),
      placedAt: order.placedAt.toISOString(),
      lines: lines
        .filter((line) => line.orderId === order.id)
        .map((line) => ({
          id: line.id,
          position: line.position,
          kind: line.kind,
          productId: line.productId,
          priceId: line.priceId,
          quantityThousandths: line.quantityThousandths,
          gross: line.gross,
          payload: line.payload,
        })),
    })),
  };
}

/**
 * What the box says happened to its orders, applied once each in order: its decision (an accept, or a refusal the
 * relay refunds), then picking, ready, out for delivery and completed, each moving the order's workflow on and telling
 * the shopper as a cloud shop's would. A status the order already passed changes nothing. Answers which of the named
 * orders the relay has refunded, so the box gives back what it holds for them.
 */
export async function applyRelayEvents(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  raw: unknown,
) {
  const input = v.parse(relayOrderEvents, raw);
  const ids = [...new Set(input.events.map((event) => event.id))];
  if (ids.length) await ackOrders(db, ctx, { ids });
  for (const event of input.events) {
    const status = await statusOf(db, ctx.orgId, event.id);
    if (!status) continue;
    if (event.status === "accepted" && status === "paid")
      await acceptStoreOrder(db, ctx, flows, event.id);
    // Moved by an earlier request whose wake failed: the box retries, so the workflow is woken again.
    else if (event.status === "accepted" && status === "accepted")
      await flows.send(event.id, "store.accepted", {});
    else if (event.status === "refunded" && status === "paid")
      await declineStoreOrder(db, ctx, flows, event.id);
    else if (event.status === "refunded" && live.includes(status))
      await cancelStoreOrder(db, ctx, flows, event.id);
    else if (isStep(event.status)) {
      const moved = await relayOrderMoved(db, ctx, { id: event.id, status: event.status });
      const wake = steps[event.status].wake;
      // Woken again on a retry (the order is still where this event put it), so a lost wake is never final.
      if (wake && (moved.moved || status === event.status)) await flows.send(event.id, wake, {});
    }
  }
  const named = [...new Set([...ids, ...input.open])];
  const refunded = named.length
    ? await db
        .select({ id: onlineOrder.id })
        .from(onlineOrder)
        .where(
          and(
            eq(onlineOrder.orgId, ctx.orgId),
            inArray(onlineOrder.id, named),
            eq(onlineOrder.status, "refunded"),
          ),
        )
    : [];
  return { refunded: refunded.map((row) => row.id) };
}

const live: Status[] = ["accepted", "picking", "ready", "out_for_delivery"];

/** Each later status: where the order may be coming from, and the workflow event it answers. */
const steps = {
  picking: { from: ["accepted"], wake: null },
  ready: { from: ["accepted", "picking"], wake: "picked" },
  out_for_delivery: { from: ["ready"], wake: null },
  completed: { from: ["ready", "out_for_delivery"], wake: "handed_over" },
} as const satisfies Record<string, { from: Status[]; wake: string | null }>;

const isStep = (status: Status): status is keyof typeof steps => status in steps;

const statusOf = async (db: ShopperDatabase, orgId: string, id: string) =>
  (
    await db
      .select({ status: onlineOrder.status })
      .from(onlineOrder)
      .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, id)))
  )[0]?.status;

/** The box has these orders: the inbox stops offering them. The first time is kept. */
const ackOrders = defineCommand({
  name: "relay.orders.acked",
  async run(tx, ctx, input: { ids: string[] }) {
    const acked = await tx
      .update(onlineOrder)
      .set({ relayAckedAt: sql`coalesce(${onlineOrder.relayAckedAt}, now())` })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), inArray(onlineOrder.id, input.ids)))
      .returning({ id: onlineOrder.id });
    return { acked: acked.length };
  },
  audit: (input, output) => ({ ids: input.ids, ...output }),
});

/** The box moved a relayed order on: the relay's copy follows and the shopper is told, once. */
const relayOrderMoved = defineCommand({
  name: "relay.order.moved",
  async run(tx, ctx, input: { id: string; status: keyof typeof steps }) {
    const moved = await move(tx, ctx.orgId, input.id, [...steps[input.status].from], input.status);
    if (!moved) return { moved };
    const now = new Date();
    const stamp = { ready: { readyAt: now }, completed: { completedAt: now } } as Record<
      string,
      Partial<typeof onlineOrder.$inferInsert>
    >;
    if (stamp[input.status])
      await tx
        .update(onlineOrder)
        .set(stamp[input.status]!)
        .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, input.id)));
    await recordStatus(tx, ctx, input.id, input.status, now);
    if (input.status !== "picking")
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "order.status",
        payload: { orderId: input.id, status: input.status },
      });
    return { moved };
  },
  audit: (input, output) => ({ id: input.id, status: input.status, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
