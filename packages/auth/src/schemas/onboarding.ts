import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const shopCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.minLength(2),
  v.maxLength(80),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
);
export const personNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120));
export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.email(),
  v.maxLength(254),
);
export const passwordSchema = v.pipe(v.string(), v.minLength(12), v.maxLength(128));
export const linkTokenSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
export const registrationStartSchema = v.strictObject({
  name: personNameSchema,
  email: emailSchema,
  shopName: personNameSchema,
  shopCode: shopCodeSchema,
});
export const registrationVerifySchema = v.strictObject({
  id: uuidV7Schema,
  token: linkTokenSchema,
});
export const registrationCompleteSchema = v.strictObject({
  id: uuidV7Schema,
  token: linkTokenSchema,
  password: passwordSchema,
  shopCode: v.optional(shopCodeSchema),
});

export const registrationResendSchema = v.strictObject({
  id: uuidV7Schema,
  resendToken: linkTokenSchema,
});
export const registrationStartResponse = v.strictObject({
  id: uuidV7Schema,
  email: v.string(),
  expiresAt: v.string(),
  resendToken: v.string(),
  deliveryStatus: v.picklist(["pending", "sent", "failed"]),
});
export const registrationViewResponse = v.strictObject({
  id: uuidV7Schema,
  email: v.string(),
  name: v.string(),
  shopName: v.string(),
  shopCode: v.string(),
  expiresAt: v.string(),
  verified: v.boolean(),
  completed: v.boolean(),
  deliveryStatus: v.optional(v.picklist(["pending", "sent", "failed"])),
});
export const registrationCompleteResponse = v.strictObject({
  orgId: uuidV7Schema,
  shopCode: v.string(),
  email: v.string(),
});

export const registrationPreviewSchema = v.union([
  registrationVerifySchema,
  registrationResendSchema,
]);
