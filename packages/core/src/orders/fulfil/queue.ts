import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  branch,
  onlineOrder,
  onlineOrderAdjustment,
  onlineOrderEvent,
  onlineOrderLine,
  onlineOrderPick,
  productBarcode,
} from "@shopper/db-pg";
import type { Queryable } from "../../types";
import type { Stage } from "../types";

/** The store's view of its orders in four columns: waiting to be accepted, being prepared, ready, and finished. */
export const stages = {
  new: ["paid"],
  preparing: ["accepted", "picking"],
  ready: ["ready", "out_for_delivery"],
  done: ["completed", "refunded"],
} as const satisfies Record<Stage, readonly string[]>;

/**
 * The order queue: how many orders sit in each stage and the orders of one, soonest slot first (finished ones, newest
 * first). `branches` limits a branch-scoped member to their own branches.
 */
export async function listOrderQueue(
  db: Queryable,
  orgId: string,
  query: { stage: Stage; branchId?: string; branches?: string[]; search?: string },
) {
  const scope = and(
    eq(onlineOrder.orgId, orgId),
    query.branchId ? eq(onlineOrder.branchId, query.branchId) : undefined,
    query.branches ? inArray(onlineOrder.branchId, query.branches) : undefined,
  );
  const counted = await db
    .select({ status: onlineOrder.status, total: count() })
    .from(onlineOrder)
    .where(scope)
    .groupBy(onlineOrder.status);
  const counts = Object.fromEntries(
    Object.entries(stages).map(([stage, statuses]) => [
      stage,
      counted
        .filter((row) => (statuses as readonly string[]).includes(row.status))
        .reduce((n, row) => n + row.total, 0),
    ]),
  ) as Record<Stage, number>;
  const search = query.search?.trim();
  const rows = await db
    .select({
      order: onlineOrder,
      branchName: branch.name,
      items:
        sql<number>`(SELECT count(*) FROM ${onlineOrderLine} WHERE ${onlineOrderLine.orgId} = ${onlineOrder.orgId} AND ${onlineOrderLine.orderId} = ${onlineOrder.id} AND ${onlineOrderLine.kind} = 'product')`.mapWith(
          Number,
        ),
    })
    .from(onlineOrder)
    .innerJoin(
      branch,
      and(eq(branch.orgId, onlineOrder.orgId), eq(branch.id, onlineOrder.branchId)),
    )
    .where(
      and(
        scope,
        inArray(onlineOrder.status, [...stages[query.stage]]),
        search
          ? sql`(${onlineOrder.customerName} ILIKE ${`%${search}%`} OR ${onlineOrder.inboxCursor}::text = ${search} OR ${onlineOrder.receiptNumber} ILIKE ${`%${search}%`})`
          : undefined,
      ),
    )
    .orderBy(query.stage === "done" ? desc(onlineOrder.updatedAt) : asc(onlineOrder.slotStart))
    .limit(100);
  return {
    counts,
    orders: rows.map(({ order, branchName, items }) => ({
      id: order.id,
      number: Number(order.inboxCursor),
      status: order.status,
      branch: { id: order.branchId, name: branchName },
      fulfilment: order.fulfilment,
      slotStart: order.slotStart.toISOString(),
      slotEnd: order.slotEnd.toISOString(),
      customerName: order.customerName,
      items,
      gross: order.fulfilledGross ?? order.gross,
      placedAt: order.placedAt.toISOString(),
    })),
  };
}

/**
 * One order for the people filling it: the customer's contact, every line with what was picked and the barcodes a
 * scanner reads, the adjustment picking made, and the timeline. Null when the order is not in the org (or branches).
 */
export async function readStaffOrder(
  db: Queryable,
  orgId: string,
  id: string,
  branches?: string[],
) {
  const [found] = await db
    .select({ order: onlineOrder, branchName: branch.name })
    .from(onlineOrder)
    .innerJoin(
      branch,
      and(eq(branch.orgId, onlineOrder.orgId), eq(branch.id, onlineOrder.branchId)),
    )
    .where(
      and(
        eq(onlineOrder.orgId, orgId),
        eq(onlineOrder.id, id),
        branches ? inArray(onlineOrder.branchId, branches) : undefined,
      ),
    );
  if (!found) return null;
  const order = found.order;
  const lines = await db
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, orgId), eq(onlineOrderLine.orderId, id)))
    .orderBy(asc(onlineOrderLine.position));
  const picks = await db
    .select()
    .from(onlineOrderPick)
    .where(and(eq(onlineOrderPick.orgId, orgId), eq(onlineOrderPick.orderId, id)));
  const products = lines.flatMap((line) => (line.productId ? [line.productId] : []));
  const barcodes = products.length
    ? await db
        .select({ productId: productBarcode.productId, code: productBarcode.code })
        .from(productBarcode)
        .where(and(eq(productBarcode.orgId, orgId), inArray(productBarcode.productId, products)))
    : [];
  const [adjustment] = await db
    .select()
    .from(onlineOrderAdjustment)
    .where(and(eq(onlineOrderAdjustment.orgId, orgId), eq(onlineOrderAdjustment.orderId, id)));
  const events = await db
    .select({ status: onlineOrderEvent.status, at: onlineOrderEvent.at })
    .from(onlineOrderEvent)
    .where(and(eq(onlineOrderEvent.orgId, orgId), eq(onlineOrderEvent.orderId, id)))
    .orderBy(asc(onlineOrderEvent.at));
  return {
    id: order.id,
    number: Number(order.inboxCursor),
    status: order.status,
    branch: { id: order.branchId, name: found.branchName },
    fulfilment: order.fulfilment,
    slotStart: order.slotStart.toISOString(),
    slotEnd: order.slotEnd.toISOString(),
    deliveryAddress: order.deliveryAddress as Record<string, string> | null,
    customer: { name: order.customerName, phone: order.customerPhone, email: order.email },
    receiptNumber: order.receiptNumber,
    gross: order.gross,
    fulfilledGross: order.fulfilledGross,
    lines: lines.map((line) => {
      const payload = line.payload as { name: string; sku?: string; baseUnit?: string };
      const pick = picks.find((row) => row.lineId === line.id);
      return {
        id: line.id,
        kind: line.kind,
        productId: line.productId,
        name: payload.name,
        sku: payload.sku ?? null,
        unit: payload.baseUnit ?? "each",
        quantityThousandths: line.quantityThousandths,
        gross: line.gross,
        barcodes: barcodes.filter((row) => row.productId === line.productId).map((row) => row.code),
        pick: pick && {
          outcome: pick.outcome,
          pickedThousandths: pick.pickedThousandths,
          substitute: pick.substituteProductId && {
            productId: pick.substituteProductId,
            name: (pick.substitutePayload as { name: string }).name,
            quantityThousandths: pick.substituteQuantityThousandths!,
            gross: pick.substituteGross!,
          },
        },
      };
    }),
    adjustment: adjustment && {
      beforeGross: adjustment.beforeGross,
      afterGross: adjustment.afterGross,
      refundAmount: adjustment.refundAmount,
    },
    events: events.map((event) => ({ status: event.status, at: event.at.toISOString() })),
  };
}
