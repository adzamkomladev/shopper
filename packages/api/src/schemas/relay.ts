import * as v from "valibot";
import { licence } from "@shopper/core/licence";

/** Staff enrol a box from its lic/1; the add-on starts on unless they say otherwise. */
export const relayEnrolment = v.strictObject({
  licence,
  onlineOrders: v.optional(v.boolean(), true),
});

export const relayOnlineOrders = v.strictObject({ onlineOrders: v.boolean() });
