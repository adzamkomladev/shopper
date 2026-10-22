import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { compactPhone, customerKindSchema } from "@shopper/core/schemas";

const id = uuidV7Schema;
const revision = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Content is checked on the host so a bad field answers INVALID_INPUT; only the spacing of a typed number is settled here.
const phone = v.pipe(v.string(), v.transform(compactPhone));
const fields = {
  name: v.string(),
  phone,
  kind: customerKindSchema,
  businessName: v.nullable(v.string()),
  tin: v.nullable(v.string()),
};

/** `customer.*`: find by phone, create and edit offline, and put a customer on the basket. The limit is not editable here. */
export const customerRequests = [
  v.strictObject({ id, type: v.literal("customer.find"), phone }),
  v.strictObject({
    id,
    type: v.literal("customer.create"),
    ...fields,
    kind: v.optional(fields.kind),
    businessName: v.optional(fields.businessName),
    tin: v.optional(fields.tin),
  }),
  v.strictObject({
    id,
    type: v.literal("customer.update"),
    customerId: id,
    ...v.partial(v.strictObject(fields)).entries,
  }),
  v.strictObject({
    id,
    type: v.literal("customer.attach"),
    expectedRevision: revision,
    customerId: v.nullable(id),
  }),
] as const;
export const customerRequestTypes = customerRequests.map((schema) => schema.entries.type.literal);

/** The customer on a basket: what an invoice names, never a limit or a balance. */
export const basketCustomer = v.strictObject({
  id,
  name: v.string(),
  phone: v.string(),
  kind: fields.kind,
  businessName: v.nullable(v.string()),
  tin: v.nullable(v.string()),
});
const found = v.strictObject({
  ...basketCustomer.entries,
  version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  /** True until the server has the customer or the edit. */
  pending: v.boolean(),
});

export const customerReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("customers"),
    customers: v.array(found),
  }),
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("customer"), customer: found }),
] as const;
