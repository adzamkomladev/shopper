import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { receiptsSchema } from "../../receipts";

export const acknowledgment = v.strictObject({
  requestId: uuidV7Schema,
  receipts: v.optional(receiptsSchema),
  accepted: v.array(
    v.strictObject({
      localId: uuidV7Schema,
      occurredAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
      sequence: v.pipe(
        v.string(),
        v.regex(/^[1-9][0-9]{0,18}$/),
        v.check((value) => BigInt(value) <= 9_223_372_036_854_775_807n),
      ),
    }),
  ),
  rejected: v.array(
    v.strictObject({
      localId: uuidV7Schema,
      code: v.pipe(v.string(), v.minLength(1)),
      message: v.pipe(v.string(), v.maxLength(500)),
    }),
  ),
});
