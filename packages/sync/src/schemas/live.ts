import * as v from "valibot";
import { sequenceSchema } from "@shopper/ports";

export const nudge = v.object({ type: v.literal("store.changed"), sequence: sequenceSchema });

import { momoView } from "@shopper/core/payments";
export const paymentNudge = v.object({
  type: v.literal("payment.updated"),
  v: v.literal(1),
  payload: momoView,
});

/** A manager's answer to a register's remote approval; the host keeps the ones for its own device. */
export const approvalNudge = v.object({
  type: v.literal("approval.decided"),
  v: v.literal(1),
  payload: v.looseObject({ id: v.string(), deviceId: v.string() }),
});
