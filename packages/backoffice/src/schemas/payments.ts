import * as v from "valibot";

export const MOMO_PROVIDERS = ["paystack", "hubtel"] as const;

/** Which provider collects the org's MoMo, and which ones this server can reach. */
export const paymentSettingsView = v.object({
  momoProvider: v.picklist(MOMO_PROVIDERS),
  providers: v.object({ paystack: v.boolean(), hubtel: v.boolean() }),
});
export type PaymentSettingsView = v.InferOutput<typeof paymentSettingsView>;
