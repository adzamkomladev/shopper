import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { orderStatuses } from "@shopper/db-pg";
import { timestamp } from "../fields";

const amount = v.pipe(v.number(), v.safeInteger());

/**
 * The paid orders a relay hands its box (v1.5 Day 50): what the box needs to fill one and nothing else. Lines carry
 * the price version the customer paid and the tax snapshot they paid it with.
 */
export const relayOrders = v.object({
  orders: v.pipe(
    v.array(
      v.object({
        id: uuidV7Schema,
        storeId: uuidV7Schema,
        branchId: uuidV7Schema,
        inboxCursor: v.pipe(v.string(), v.regex(/^\d{1,19}$/)),
        fulfilment: v.picklist(["pickup", "delivery"]),
        slotStart: timestamp,
        slotEnd: timestamp,
        deliveryAddress: v.nullable(v.record(v.string(), v.string())),
        customerName: v.string(),
        customerPhone: v.pipe(v.string(), v.regex(/^0[0-9]{9}$/)),
        email: v.nullable(v.string()),
        base: amount,
        vat: amount,
        nhil: amount,
        getfund: amount,
        covid: amount,
        gross: amount,
        receiptNumber: v.nullable(v.string()),
        receipt: v.unknown(),
        paidAt: timestamp,
        placedAt: timestamp,
        lines: v.array(
          v.object({
            id: uuidV7Schema,
            position: v.pipe(v.number(), v.safeInteger()),
            kind: v.picklist(["product", "delivery"]),
            productId: v.nullable(uuidV7Schema),
            priceId: v.nullable(uuidV7Schema),
            quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
            gross: amount,
            payload: v.record(v.string(), v.unknown()),
          }),
        ),
      }),
    ),
    v.maxLength(100),
  ),
});
export type RelayOrder = v.InferOutput<typeof relayOrders>["orders"][number];

/** What the box tells its relay: each status its orders reached, in order, and the orders it still has open. */
export const relayOrderEvents = v.strictObject({
  events: v.pipe(
    v.array(v.strictObject({ id: uuidV7Schema, status: v.picklist(orderStatuses) })),
    v.maxLength(500),
  ),
  open: v.pipe(v.array(uuidV7Schema), v.maxLength(1000)),
});

/** The relay's answer: which of those orders it has refunded (its own timeouts, or the box's refusals). */
export const relayOrdersTold = v.object({ refunded: v.array(uuidV7Schema) });
