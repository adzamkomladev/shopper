import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  onlineOrderEvent,
  onlineOrderLine,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { cancelRelayedOrder } from "../../orders/fulfil/cancel";
import { recordStatus } from "../../orders/fulfil/events";
import { move, readOrder } from "../../orders/flow";
import { reserveStock } from "../../orders/holds";
import { relayOrders, relayOrdersTold, type RelayOrder } from "../../schemas/orders/relay";
import { checkPrices } from "./prices";
import type { RelaySend } from "../types";

/** How long after its slot ends a relayed order's stock stays held; the relay refunds an uncollected order by then. */
const HOLD_AFTER_SLOT_MS = 24 * 3_600_000;

/**
 * The box's order inbox (v1.5 Day 50), the first step of each Publisher run: takes the relay's paid orders (a
 * redelivered one changes nothing) and decides every relayed order still waiting: its stock held, or turned down when
 * the branch cannot fill it. Answers the relay's response when it did not answer the orders.
 */
export async function takeOrders(
  db: ShopperDatabase,
  context: CommandContext,
  send: RelaySend,
  now: Date,
) {
  const response = await send("/relay/orders", { method: "GET" });
  if (!response.ok) return response;
  const { orders } = v.parse(relayOrders, await response.json());
  if (orders.length) await receiveOrders(db, context, { orders });
  const waiting = await db
    .select({ id: onlineOrder.id })
    .from(onlineOrder)
    .where(
      and(
        eq(onlineOrder.orgId, context.orgId),
        eq(onlineOrder.channel, "relay"),
        eq(onlineOrder.status, "paid"),
      ),
    )
    .orderBy(asc(onlineOrder.paidAt));
  for (const order of waiting) await decideOrder(db, context, { id: order.id, now });
  return undefined;
}

/**
 * The last order step of a run, after the publish (so the relay never counts an order twice upwards): every status
 * the box's relayed orders reached that the relay has not heard, and the orders still open. Whatever the relay has
 * refunded meanwhile (an order not picked or collected in time) is given back here. Answers the relay's response
 * when it did not take them.
 */
export async function tellOrders(db: ShopperDatabase, context: CommandContext, send: RelaySend) {
  const events = await db
    .select({
      id: onlineOrderEvent.id,
      orderId: onlineOrderEvent.orderId,
      status: onlineOrderEvent.status,
    })
    .from(onlineOrderEvent)
    .innerJoin(
      onlineOrder,
      and(
        eq(onlineOrder.orgId, onlineOrderEvent.orgId),
        eq(onlineOrder.id, onlineOrderEvent.orderId),
      ),
    )
    .where(
      and(
        eq(onlineOrderEvent.orgId, context.orgId),
        eq(onlineOrder.channel, "relay"),
        isNull(onlineOrderEvent.relayedAt),
      ),
    )
    .orderBy(asc(onlineOrderEvent.at), asc(onlineOrderEvent.id));
  const live = await db
    .select({ id: onlineOrder.id })
    .from(onlineOrder)
    .where(
      and(
        eq(onlineOrder.orgId, context.orgId),
        eq(onlineOrder.channel, "relay"),
        inArray(onlineOrder.status, ["accepted", "picking", "ready", "out_for_delivery"]),
      ),
    );
  if (!events.length && !live.length) return undefined;
  const response = await send("/relay/orders/events", {
    method: "POST",
    body: JSON.stringify({
      events: events.map((event) => ({ id: event.orderId, status: event.status })),
      open: live.map((order) => order.id),
    }),
  });
  if (!response.ok) return response;
  const { refunded } = v.parse(relayOrdersTold, await response.json());
  await toldOrders(db, context, { events: events.map((event) => event.id), refunded });
  for (const id of refunded) await cancelRelayedOrder(db, context, { id });
  return undefined;
}

/** The relay's paid orders as the box's own, ids and all; one it already has is left as it is. */
const receiveOrders = defineCommand({
  name: "relay.orders.received",
  async run(tx, ctx, input: { orders: RelayOrder[] }) {
    const fresh = await tx
      .insert(onlineOrder)
      .values(
        input.orders.map((order) => ({
          orgId: ctx.orgId,
          id: order.id,
          channel: "relay" as const,
          status: "paid" as const,
          storeId: order.storeId,
          branchId: order.branchId,
          inboxCursor: BigInt(order.inboxCursor),
          fulfilment: order.fulfilment,
          slotStart: new Date(order.slotStart),
          slotEnd: new Date(order.slotEnd),
          deliveryAddress: order.deliveryAddress,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          email: order.email,
          base: money(order.base),
          vat: money(order.vat),
          nhil: money(order.nhil),
          getfund: money(order.getfund),
          covid: money(order.covid),
          gross: money(order.gross),
          holdExpiresAt: new Date(order.slotEnd),
          paidAt: new Date(order.paidAt),
          receiptNumber: order.receiptNumber,
          receipt: order.receipt ?? null,
          placedAt: new Date(order.placedAt),
        })),
      )
      .onConflictDoNothing({ target: [onlineOrder.orgId, onlineOrder.id] })
      .returning({ id: onlineOrder.id });
    const taken = new Set(fresh.map((row) => row.id));
    const lines = input.orders
      .filter((order) => taken.has(order.id))
      .flatMap((order) =>
        order.lines.map((line) => ({
          ...line,
          orgId: ctx.orgId,
          orderId: order.id,
          gross: money(line.gross),
        })),
      );
    if (lines.length) await tx.insert(onlineOrderLine).values(lines);
    return { received: [...taken] };
  },
  audit: (input, output) => ({ offered: input.orders.map((order) => order.id), ...output }),
});

/**
 * The box decides a relayed order against its own stock: every line held at the branch until a day after the slot
 * (accepted), or none and the order turned down (the relay refunds it). An accepted order keeps the price the customer
 * paid; any line the box would now price or tax differently is kept on the order for the pickers to see.
 */
const decideOrder = defineCommand({
  name: "relay.order.decided",
  async run(tx, ctx, input: { id: string; now: Date }) {
    const order = await readOrder(tx, ctx.orgId, input.id);
    if (order.status !== "paid") return { decision: null };
    const lines = (
      await tx
        .select()
        .from(onlineOrderLine)
        .where(and(eq(onlineOrderLine.orgId, ctx.orgId), eq(onlineOrderLine.orderId, order.id)))
        .orderBy(asc(onlineOrderLine.position))
    ).flatMap((line) => (line.productId ? [{ ...line, productId: line.productId }] : []));
    const { short } = await reserveStock(tx, ctx.orgId, {
      branchId: order.branchId,
      orderId: order.id,
      lines,
      expiresAt: new Date(order.slotEnd.getTime() + HOLD_AFTER_SLOT_MS),
      now: input.now,
    });
    const decision = short.length ? ("refunded" as const) : ("accepted" as const);
    await move(tx, ctx.orgId, order.id, "paid", decision);
    await recordStatus(tx, ctx, order.id, decision, input.now);
    if (short.length) return { decision, short };
    const priceCheck = await checkPrices(tx, ctx.orgId, order, lines, input.now);
    await tx
      .update(onlineOrder)
      .set({ acceptedAt: input.now, priceCheck: priceCheck.length ? priceCheck : null })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
    return { decision, flagged: priceCheck.map((line) => line.lineId) };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** These statuses reached the relay. */
const toldOrders = defineCommand({
  name: "relay.orders.told",
  async run(tx, ctx, input: { events: string[]; refunded: string[] }) {
    if (input.events.length)
      await tx
        .update(onlineOrderEvent)
        .set({ relayedAt: new Date() })
        .where(
          and(eq(onlineOrderEvent.orgId, ctx.orgId), inArray(onlineOrderEvent.id, input.events)),
        );
    return { told: input.events.length };
  },
  audit: (input, output) => ({ refunded: input.refunded, ...output }),
});
