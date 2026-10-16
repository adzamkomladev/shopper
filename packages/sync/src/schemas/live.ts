import * as v from "valibot";
import { sequenceSchema } from "@shopper/ports";

export const nudge = v.object({ type: v.literal("store.changed"), sequence: sequenceSchema });

import { momoView } from "@shopper/core/payments";
export const paymentNudge = v.object({
  type: v.literal("payment.updated"),
  v: v.literal(1),
  payload: momoView,
});
