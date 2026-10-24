import * as v from "valibot";
import { tillId } from "../till/fields";
import { businessMessage, customerId, editableCustomerFields } from "./inputs";

const origin = {
  orgId: tillId,
  /** The cashier session that made the change; the server judges it as it does a sale's. */
  sessionId: tillId,
  occurredAt: v.pipe(v.string(), v.isoTimestamp()),
};
const editable = v.strictObject(editableCustomerFields);
/** The fields changed, and only those: an unchanged field must not overwrite another writer's edit. */
export const customerChanges = v.pipe(
  v.partial(editable),
  v.check((changes) => Object.keys(changes).length > 0, "Change at least one field"),
);

/** `customer.created` v1: a customer made on a till, keyed by its UUIDv7 so a retry replays. */
export const customerCreated = v.strictObject({
  v: v.literal(1),
  type: v.literal("customer.created"),
  customer: v.pipe(
    v.strictObject({ ...origin, id: customerId, ...editableCustomerFields }),
    v.check((c) => c.kind !== "business" || Boolean(c.businessName), businessMessage),
  ),
});

/** `customer.updated` v1: an edit made on a till that last saw `baseVersion` of the customer. */
export const customerUpdated = v.strictObject({
  v: v.literal(1),
  type: v.literal("customer.updated"),
  customer: v.strictObject({
    ...origin,
    id: customerId,
    baseVersion: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    changes: customerChanges,
  }),
});

export const customerEvent = v.variant("type", [customerCreated, customerUpdated]);
export type CustomerEvent = v.InferOutput<typeof customerEvent>;
