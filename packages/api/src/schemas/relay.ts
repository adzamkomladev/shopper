import * as v from "valibot";
import { licence } from "@shopper/core/licence";

/** Staff enrol a box from its lic/1; the add-on starts on unless they say otherwise. */
export const relayEnrolment = v.strictObject({
  licence,
  onlineOrders: v.optional(v.boolean(), true),
});

export const relayOnlineOrders = v.strictObject({ onlineOrders: v.boolean() });

/** The box's order-inbox cursor: the last `inbox_cursor` it has, 0 at the start. */
export const relayCursor = v.pipe(
  v.optional(v.string(), "0"),
  v.regex(/^\d{1,19}$/),
  v.transform((digits) => BigInt(digits)),
);
