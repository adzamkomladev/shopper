import * as v from "valibot";
import { licence } from "@shopper/core/licence";
import { uuidV7Schema } from "@shopper/ports";

/** Staff enrol a box from its lic/1; the add-on starts on unless they say otherwise. */
export const relayEnrolment = v.strictObject({
  licence,
  onlineOrders: v.optional(v.boolean(), true),
});

export const relayOnlineOrders = v.strictObject({ onlineOrders: v.boolean() });

/** Which store's inbox the box reads, and the last `inbox_cursor` it has there (0 at the start). */
export const relayInboxQuery = v.object({
  store: uuidV7Schema,
  after: v.pipe(
    v.optional(v.string(), "0"),
    v.regex(/^\d{1,19}$/),
    v.transform((digits) => BigInt(digits)),
  ),
});
