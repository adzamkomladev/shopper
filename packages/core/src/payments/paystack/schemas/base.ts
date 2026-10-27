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

const pesewas = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number))]),
  v.safeInteger(),
);

export const webhookSchema = v.variant("event", [
  v.object({
    event: v.picklist(["charge.success", "charge.failed"]),
    data: v.object({
      reference: v.string(),
      status: v.string(),
      amount: pesewas,
      gateway_response: v.optional(v.nullable(v.string())),
      metadata: v.optional(v.unknown()),
    }),
  }),
  // Refund events name the refunded charge; the amount is a string in some deliveries.
  v.object({
    event: v.picklist(["refund.processed", "refund.failed"]),
    data: v.object({
      id: v.optional(v.union([v.number(), v.string()])),
      transaction_reference: v.string(),
      refund_reference: v.optional(v.nullable(v.string())),
      status: v.string(),
      amount: pesewas,
    }),
  }),
]);
export type PaystackWebhook = v.InferOutput<typeof webhookSchema>;

export const refundResponseSchema = v.object({
  status: v.boolean(),
  message: v.string(),
  data: v.object({
    id: v.union([v.number(), v.string()]),
    status: v.string(),
  }),
});

export const chargeResultSchema = v.object({
  status: v.picklist(["pending", "otp", "confirmed", "failed"]),
  providerReference: v.optional(v.string()),
  message: v.optional(v.string()),
});
export type ChargeResult = v.InferOutput<typeof chargeResultSchema>;
export type RefundResult = {
  status: "pending" | "processed" | "failed";
  providerReference: string;
};
