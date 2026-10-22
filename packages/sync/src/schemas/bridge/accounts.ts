import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const id = uuidV7Schema;
const amount = v.pipe(v.number(), v.safeInteger());

/** Credit is online only: read what the attached customer may spend, and take a server hold as a tender. */
export const accountRequests = [
  v.strictObject({ id, type: v.literal("customer.account"), customerId: id }),
  v.strictObject({
    id,
    type: v.literal("tender.account"),
    expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
    kind: v.literal("credit"),
    amount: v.pipe(amount, v.minValue(1)),
  }),
  /** Cash or MoMo paid onto an account at the drawer. Content is checked on the host so a bad amount answers INVALID_INPUT. */
  v.strictObject({
    id,
    type: v.literal("account.payment"),
    customerId: id,
    method: v.picklist(["cash", "momo"]),
    amount: v.number(),
    reference: v.optional(v.string()),
  }),
] as const;
export const accountRequestTypes = accountRequests.map((schema) => schema.entries.type.literal);

/** What the server says the customer may spend now; below zero balance is a deposit. */
export const accountView = v.strictObject({
  limit: amount,
  balance: amount,
  held: amount,
  available: amount,
  eligible: v.boolean(),
  points: amount,
  pointValue: amount,
  loyaltyEnabled: v.boolean(),
});
export const accountReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("accountPayment"),
    payment: v.strictObject({
      id,
      customerId: id,
      shiftId: id,
      method: v.picklist(["cash", "momo"]),
      amount: v.pipe(amount, v.minValue(1)),
      reference: v.nullable(v.string()),
    }),
    /** False when there is no printer or it failed: the payment stands and the receipt can be reprinted from the customer. */
    printed: v.boolean(),
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("account"),
    account: accountView,
  }),
] as const;
