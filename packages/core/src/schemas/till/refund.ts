import * as v from "valibot";
import { money } from "@shopper/money";
import { createEventDecoder } from "../events";
import { tillId } from "./fields";
import { registeredLines, saleTaxSnapshot, saleTotals } from "./sale";

const nonnegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money));
export const refundTender = v.variant("kind", [
  v.strictObject({ kind: v.literal("cash") }),
  v.strictObject({
    kind: v.picklist(["card", "momo"]),
    reference: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  }),
]);
export const refundSnapshot = v.strictObject({
  id: tillId,
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  cashierId: tillId,
  sessionId: tillId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  deviceTime: v.pipe(v.string(), v.isoTimestamp()),
  clockOffsetMs: v.pipe(v.number(), v.safeInteger()),
  originalSaleId: tillId,
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  /** The manager who approved the refund; null when no manager approval was required. */
  approverId: v.nullable(tillId),
  lines: v.pipe(
    v.array(
      v.strictObject({
        id: tillId,
        originalLineId: tillId,
        productId: tillId,
        name: v.string(),
        baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
        /** This refund's share of the sold line's tax, in the sold snapshot's shape. */
        tax: saleTaxSnapshot,
      }),
    ),
    v.minLength(1),
  ),
  totals: saleTotals,
  /** Signed: the cash paid out minus the refunded gross. */
  cashRounding: v.pipe(v.number(), v.safeInteger(), v.transform(money)),
  /** What the payout is: the gross less what went back to the account and to redeemed points, plus the rounding. */
  total: nonnegative,
  /** The part of the gross credited to the customer's account. */
  accountCredit: nonnegative,
  /** The redeemed points handed back, and what they were worth. */
  pointsReturned: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  pointsValue: nonnegative,
  tender: refundTender,
});
export const refundEvent = v.strictObject({
  v: v.literal(3),
  type: v.literal("refund.recorded"),
  refund: refundSnapshot,
});
export type RefundEvent = v.InferOutput<typeof refundEvent>;
export type RefundSnapshot = v.InferOutput<typeof refundSnapshot>;

/** v1 had no account or points split: a v1 refund paid everything out in its tender. v2 lines had no registration flag. */
export const decodeRefundEvent = createEventDecoder(3, (raw) => v.parse(refundEvent, raw), {
  1: (raw) => {
    const event = raw as { refund?: object };
    return {
      ...event,
      v: 2,
      refund: { accountCredit: 0, pointsReturned: 0, pointsValue: 0, ...event.refund },
    };
  },
  2: (raw) => {
    const event = raw as { refund: { lines?: unknown[] } };
    return { ...event, v: 3, refund: registeredLines(event.refund) };
  },
});
