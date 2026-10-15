import * as v from "valibot";

export const NETWORKS = ["mtn", "telecel", "airteltigo"] as const;
export const networkSchema = v.picklist(NETWORKS);
export type MomoNetwork = v.InferOutput<typeof networkSchema>;

export const PROVIDER_CODES = { mtn: "mtn", telecel: "vod", airteltigo: "atl" } as const;

export const chargeRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.email()),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  currency: v.literal("GHS"),
  reference: v.pipe(v.string(), v.minLength(1)),
  mobile_money: v.strictObject({
    phone: v.pipe(v.string(), v.minLength(1)),
    provider: v.picklist(["mtn", "vod", "atl"]),
  }),
});

export const submitOtpRequestSchema = v.strictObject({
  otp: v.pipe(v.string(), v.minLength(1)),
  reference: v.pipe(v.string(), v.minLength(1)),
});

export const chargeStatusSchema = v.picklist([
  "send_otp",
  "pay_offline",
  "pending",
  "success",
  "failed",
]);

/** Charge and submit_otp both answer with this envelope; `data.status` drives the flow. */
export const chargeResponseSchema = v.object({
  status: v.boolean(),
  message: v.string(),
  data: v.object({
    reference: v.string(),
    status: chargeStatusSchema,
    message: v.optional(v.nullable(v.string())),
    display_text: v.optional(v.string()),
  }),
});

export const verifyResponseSchema = v.object({
  status: v.boolean(),
  message: v.string(),
  data: v.object({
    reference: v.string(),
    status: v.string(),
    gateway_response: v.optional(v.nullable(v.string())),
  }),
});

export const errorResponseSchema = v.object({
  message: v.string(),
  code: v.optional(v.string()),
});

export const webhookSchema = v.object({
  event: v.picklist(["charge.success", "charge.failed"]),
  data: v.object({
    reference: v.string(),
    status: v.string(),
    amount: v.pipe(v.number(), v.safeInteger()),
    gateway_response: v.optional(v.nullable(v.string())),
  }),
});
export type PaystackWebhook = v.InferOutput<typeof webhookSchema>;

export const chargeResultSchema = v.object({
  status: v.picklist(["pending", "otp", "confirmed", "failed"]),
  providerReference: v.optional(v.string()),
  message: v.optional(v.string()),
});
export type ChargeResult = v.InferOutput<typeof chargeResultSchema>;
