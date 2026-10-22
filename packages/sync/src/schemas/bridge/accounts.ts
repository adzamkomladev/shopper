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
    kind: v.literal("account"),
    account: accountView,
  }),
] as const;
