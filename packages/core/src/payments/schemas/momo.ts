import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { ghanaPhone } from "../../schemas/fields";
import { networkSchema } from "../paystack/schemas/base";

export const phoneFingerprintSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));

export const momoInput = v.strictObject({
  reference: v.optional(uuidV7Schema),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(100), v.multipleOf(100)),
  phone: ghanaPhone,
  network: networkSchema,
});
export const momoParams = v.object({
  orgId: uuidV7Schema,
  reference: uuidV7Schema,
  phone: momoInput.entries.phone,
  email: v.pipe(v.string(), v.email()),
});
export const momoOtp = v.strictObject({ otp: v.pipe(v.string(), v.regex(/^\d{4,10}$/)) });
export const momoEvent = v.variant("type", [
  v.object({ type: v.literal("otp"), ...momoOtp.entries }),
  v.object({ type: v.literal("settled") }),
]);

export const momoView = v.object({
  reference: uuidV7Schema,
  amount: momoInput.entries.amount,
  phone: v.pipe(v.string(), v.regex(/^\*{6}\d{4}$/)),
  network: networkSchema,
  status: v.picklist(["pending", "otp", "confirmed", "failed", "expired"]),
  failureReason: v.nullable(v.string()),
});
