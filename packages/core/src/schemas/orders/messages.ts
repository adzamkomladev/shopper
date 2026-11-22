import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** The queue message that tells a shopper their order is paid. */
export const orderMessage = v.object({ payload: v.object({ orderId: uuidV7Schema }) });

/** The queue message that sends one owed order refund back to its payer. */
export const orderRefundMessage = v.object({ payload: v.object({ id: uuidV7Schema }) });

/** The queue message that tells a shopper their order reached a status. */
/** A relay order past its deadline (v1.5 Day 52): its shopper is told they may cancel for a refund. */
export const orderOverdueMessage = v.object({ payload: v.object({ orderId: uuidV7Schema }) });

export const orderStatusMessage = v.object({
  payload: v.object({
    orderId: uuidV7Schema,
    status: v.picklist(["ready", "out_for_delivery", "completed", "refunded"]),
  }),
});
