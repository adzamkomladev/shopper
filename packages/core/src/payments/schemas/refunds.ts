import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const refundParams = v.object({ orgId: uuidV7Schema, id: uuidV7Schema });

/** The `payment.refund` queue message: the payment refund whose workflow to start. */
export const refundMessage = v.object({ id: uuidV7Schema });
