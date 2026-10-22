import * as v from "valibot";
import { money } from "@shopper/money";
import { tillId } from "./fields";
import { saleTaxSnapshot, saleTotals } from "./sale";

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
  accountCredit: v.optional(nonnegative, money(0)),
  /** The redeemed points handed back, and what they were worth. */
  pointsReturned: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(0)), 0),
  pointsValue: v.optional(nonnegative, money(0)),
  tender: refundTender,
});
export const refundEvent = v.strictObject({
  v: v.literal(1),
  type: v.literal("refund.recorded"),
  refund: refundSnapshot,
});
export type RefundEvent = v.InferOutput<typeof refundEvent>;
export type RefundSnapshot = v.InferOutput<typeof refundSnapshot>;

export const decodeRefundEvent = (raw: unknown) => v.parse(refundEvent, raw);
