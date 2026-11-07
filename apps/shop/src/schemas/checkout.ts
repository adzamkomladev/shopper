import * as v from "valibot";
import { money } from "@shopper/money";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const named = v.object({ id: v.string(), name: v.string() });
const totals = v.object({
  base: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
  gross: amount,
});

/** The basket priced by the server exactly as the till would price it now. */
export const cartQuote = v.object({
  branch: named,
  lines: v.array(
    v.object({
      productId: v.string(),
      quantityThousandths: v.number(),
      name: v.nullable(v.string()),
      baseUnit: v.nullable(v.string()),
      imageAssetId: v.nullable(v.string()),
      availableThousandths: v.number(),
      tax: v.nullable(v.object({ unitPrice: amount, gross: amount })),
      problem: v.nullable(v.picklist(["unavailable", "short"])),
    }),
  ),
  delivery: v.nullable(v.object({ gross: amount })),
  totals: v.object({ ...totals.entries }),
  count: v.number(),
});
export type CartQuote = v.InferOutput<typeof cartQuote>;

/** What a branch offers and when: each slot with its places left. */
export const fulfilmentOptions = v.object({
  branch: named,
  pickup: v.boolean(),
  delivery: v.boolean(),
  deliveryFee: amount,
  slots: v.array(v.object({ start: v.string(), end: v.string(), remaining: v.number() })),
});
export type FulfilmentOptions = v.InferOutput<typeof fulfilmentOptions>;

/** A placed order, as the confirmation page shows it. */
export const placedOrder = v.object({
  id: v.string(),
  number: v.number(),
  status: v.picklist([
    "placed",
    "expired",
    "cancelled",
    "paid",
    "accepted",
    "picking",
    "ready",
    "out_for_delivery",
    "completed",
    "refunded",
  ]),
  branch: named,
  fulfilment: v.picklist(["pickup", "delivery"]),
  slotStart: v.string(),
  slotEnd: v.string(),
  deliveryAddress: v.nullable(v.record(v.string(), v.nullable(v.string()))),
  customerName: v.string(),
  holdExpiresAt: v.string(),
  receiptNumber: v.nullable(v.string()),
  paidAt: v.nullable(v.string()),
  /** The latest attempt to pay: what the shopper sees while they wait, and why one failed. */
  payment: v.nullable(
    v.object({
      id: v.string(),
      method: v.picklist(["card", "momo"]),
      provider: v.picklist(["paystack", "hubtel"]),
      status: v.picklist(["pending", "otp", "confirmed", "failed", "expired"]),
      checkoutUrl: v.nullable(v.string()),
      failureReason: v.nullable(v.string()),
    }),
  ),
  timeline: v.array(v.object({ status: v.string(), at: v.string() })),
  /** What picking changed, once the pick is finished. */
  adjustment: v.nullable(
    v.object({ beforeGross: amount, afterGross: amount, refundAmount: amount }),
  ),
  review: v.nullable(
    v.object({
      rating: v.number(),
      comment: v.nullable(v.string()),
      status: v.picklist(["submitted", "flagged", "published", "rejected"]),
    }),
  ),
  totals,
  lines: v.array(
    v.object({
      pick: v.nullable(
        v.object({
          outcome: v.picklist(["picked", "short", "substituted"]),
          pickedThousandths: v.number(),
          substitute: v.nullable(
            v.object({ name: v.string(), quantityThousandths: v.number(), gross: amount }),
          ),
        }),
      ),
      kind: v.picklist(["product", "delivery"]),
      productId: v.nullable(v.string()),
      quantityThousandths: v.number(),
      gross: amount,
      name: v.string(),
      baseUnit: v.string(),
    }),
  ),
});
export type PlacedOrder = v.InferOutput<typeof placedOrder>;

/** The order page's address: the checkout key that reads the order back. */
export const orderSearch = v.object({
  t: v.fallback(v.optional(v.pipe(v.string(), v.uuid())), undefined),
});

/** What a shop shows of its reviews. */
export const shopReviews = v.object({
  count: v.number(),
  average: v.nullable(v.number()),
  latest: v.array(
    v.object({
      rating: v.number(),
      comment: v.nullable(v.string()),
      authorName: v.string(),
      at: v.string(),
    }),
  ),
});
export type ShopReviews = v.InferOutput<typeof shopReviews>;

/** The reply to a review: it was received. */
export const reviewSent = v.object({ reviewed: v.boolean() });
