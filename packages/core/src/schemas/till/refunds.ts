import * as v from "valibot";
import { money } from "@shopper/money";
import { receiptDocument } from "../receipts/document";
import { tillId } from "./fields";
import { refundTender } from "./refund";
import { receiptNumberSchema, saleSnapshot } from "./sale";

const quantity = v.number();

/** A sale of another register of the store, as `GET /sync/sales/lookup` answers it. */
export const serverSale = v.strictObject({
  sale: saleSnapshot,
  occurredAt: v.pipe(v.string(), v.isoTimestamp()),
  receipt: v.nullable(receiptDocument),
  /** Refunded quantity per sold line, across every register. */
  refunded: v.record(v.string(), v.pipe(v.number(), v.safeInteger(), v.minValue(0))),
  /** Gross already paid back in cash, which fixes the next cash payout's rounding. */
  cashRefunded: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
  /** What refunds already credited to the customer's account; older servers send none. */
  accountCredited: v.optional(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
    0,
  ),
  /** The redeemed points refunds already handed back; older servers send none. */
  pointsReturned: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(0)), 0),
  finalSale: v.record(v.string(), v.boolean()),
});
export type ServerSale = v.InferOutput<typeof serverSale>;

const request = {
  at: v.date(),
  saleId: tillId,
  lines: v.pipe(
    v.array(v.strictObject({ lineId: tillId, quantityThousandths: quantity })),
    v.minLength(1),
  ),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  tender: refundTender,
  /** A manager the host already verified by PIN; never taken from the UI. */
  approverId: v.optional(tillId),
  /** Present when the sale was made on another register. */
  original: v.optional(serverSale),
  /** Fixed ids, when the refund was already sent to the server under them. */
  id: v.optional(tillId),
  lineIds: v.optional(v.array(tillId)),
  /** The credit-note number reserved before the refund was sent to the server. */
  creditNoteNumber: v.optional(receiptNumberSchema),
};
export const planRefundInput = v.strictObject(request);
export const recordRefundInput = v.strictObject({
  ...request,
  acceptedAt: v.optional(v.date()),
});

export const eligibilityInput = v.strictObject({
  at: v.date(),
  saleId: tillId,
  original: v.optional(serverSale),
});
