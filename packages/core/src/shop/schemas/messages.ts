import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** The queue message for one code: which login and which send. The code itself is derived by the consumer. */
export const shopOtpMessage = v.object({
  payload: v.object({
    loginId: uuidV7Schema,
    send: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
});
