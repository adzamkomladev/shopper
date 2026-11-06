import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { branchFulfilment, onlineOrder } from "@shopper/db-pg";
import type { Queryable } from "../types";

/** How many days ahead a shopper may book. */
export const SLOT_DAYS = 3;
const minute = 60_000;

type Fulfilment = typeof branchFulfilment.$inferSelect;

/** The branch's fulfilment settings, or undefined when it takes no online orders. */
export async function readFulfilment(db: Queryable, orgId: string, branchId: string) {
  const [row] = await db
    .select()
    .from(branchFulfilment)
    .where(and(eq(branchFulfilment.orgId, orgId), eq(branchFulfilment.branchId, branchId)));
  return row;
}

/** What a shopper can choose at a branch: pickup, delivery and its fee, and each open slot with its places left. */
export async function listSlots(db: Queryable, orgId: string, branchId: string, now = new Date()) {
  const fulfilment = await readFulfilment(db, orgId, branchId);
  if (!fulfilment) return { pickup: false, delivery: false, deliveryFee: 0, slots: [] };
  const starts = slotStarts(fulfilment, now);
  const taken = await takenSlots(db, orgId, branchId, starts);
  return {
    pickup: fulfilment.pickup,
    delivery: fulfilment.delivery,
    deliveryFee: fulfilment.deliveryFee,
    slots: starts.map((start) => ({
      start: start.toISOString(),
      end: new Date(start.getTime() + fulfilment.slotMinutes * minute).toISOString(),
      remaining: Math.max(0, fulfilment.slotCapacity - (taken.get(start.getTime()) ?? 0)),
    })),
  };
}

/**
 * Every slot start from today for SLOT_DAYS days, inside opening hours and no sooner than the lead time. Accra keeps
 * UTC all year, so the branch's clock times are UTC times.
 */
export function slotStarts(fulfilment: Fulfilment, now: Date) {
  const minutes = (clock: string) => {
    const [hours, mins] = clock.split(":").map(Number);
    return hours! * 60 + mins!;
  };
  const opens = minutes(fulfilment.opens);
  const closes = minutes(fulfilment.closes);
  const earliest = now.getTime() + fulfilment.leadMinutes * minute;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: SLOT_DAYS }, (_, day) => today + day * 1440 * minute).flatMap(
    (midnight) =>
      Array.from(
        { length: Math.floor((closes - opens) / fulfilment.slotMinutes) },
        (_, index) => new Date(midnight + (opens + index * fulfilment.slotMinutes) * minute),
      ).filter((start) => start.getTime() >= earliest),
  );
}

/** Orders still claiming each slot start (expired and cancelled orders give their place back). */
export async function takenSlots(db: Queryable, orgId: string, branchId: string, starts: Date[]) {
  if (!starts.length) return new Map<number, number>();
  const rows = await db
    .select({ start: onlineOrder.slotStart, orders: count() })
    .from(onlineOrder)
    .where(
      and(
        eq(onlineOrder.orgId, orgId),
        eq(onlineOrder.branchId, branchId),
        inArray(onlineOrder.status, ["placed", "paid", "accepted"]),
        gte(onlineOrder.slotStart, starts[0]!),
        lte(onlineOrder.slotStart, starts.at(-1)!),
      ),
    )
    .groupBy(onlineOrder.slotStart);
  return new Map(rows.map((row) => [row.start.getTime(), row.orders]));
}
