import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** The queue message: one receipt email row to send. */
export const receiptEmailMessage = v.object({
  payload: v.object({ id: uuidV7Schema, saleId: uuidV7Schema }),
});

/** A back-office resend; `requestKey` is per click, so a double click or a retried request sends once. */
export const receiptEmailRequest = v.strictObject({
  requestKey: uuidV7Schema,
  email: v.optional(v.pipe(v.string(), v.trim(), v.email(), v.maxLength(200))),
});
