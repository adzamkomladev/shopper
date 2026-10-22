import * as v from "valibot";
import { customerKinds } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { ghanaPhone, name, text } from "../fields";
import { listQuery } from "../catalogue/inputs";

/** A TIN as GRA prints it: a letter and ten digits, or the older GHA-NNNNNNNNN-N. */
export const tinSchema = v.pipe(v.string(), v.regex(/^(?:[A-Z]\d{10}|GHA-\d{9}-\d)$/));

export const customerId = v.pipe(
  uuidV7Schema,
  v.transform((value) => value.toLowerCase()),
);

export const customerKindSchema = v.picklist(customerKinds);

/** What a till may edit; the email stays with the portal. */
export const editableCustomerFields = {
  name,
  phone: ghanaPhone,
  kind: customerKindSchema,
  businessName: v.optional(v.nullable(text(200))),
  tin: v.optional(v.nullable(tinSchema)),
};
const fields = {
  ...editableCustomerFields,
  email: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.email(), v.maxLength(200)))),
};
export const businessMessage = "A business needs a business name";

/** A customer keyed by the client's UUIDv7, so a retried create replays instead of doubling. */
export const customerInput = v.pipe(
  v.strictObject({ id: customerId, ...fields, kind: v.optional(fields.kind, "individual") }),
  v.check((c) => c.kind !== "business" || Boolean(c.businessName), businessMessage),
);
export type CustomerInput = v.InferOutput<typeof customerInput>;

export const customerPatch = v.partial(v.strictObject(fields));
/** The editable fields of a whole customer: what a patch must leave valid. */
export const customerFields = v.pipe(
  v.strictObject(fields),
  v.check((c) => c.kind !== "business" || Boolean(c.businessName), businessMessage),
);
export type CustomerFields = v.InferOutput<typeof customerFields>;

export const customerQuery = v.object({
  q: v.optional(text(100)),
  archived: v.optional(v.literal("1")),
  cursor: v.optional(customerId),
  limit: listQuery.entries.limit,
});

/** The body of a merge: the customer folded into the one in the path. */
export const customerMerge = v.strictObject({ loserId: customerId });
