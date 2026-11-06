import * as v from "valibot";
import { toPesewas, type Money } from "@shopper/money";
import { PaystackError } from "./errors";
import { checkoutResponseSchema } from "./schemas/checkout";
import type { PaystackOptions } from "./types";

/** A Paystack hosted checkout for `reference`: the page the payer opens; the webhook carries the reference back. */
export async function initializeCheckout(
  options: PaystackOptions,
  input: {
    reference: string;
    amount: Money;
    email: string;
    metadata: Record<string, string>;
    /** The shop's payout subaccount: where the money lands. */
    subaccount?: string;
    /** Where Paystack sends the payer back to once they have paid or given up. */
    callbackUrl?: string;
  },
) {
  const response = await (options.fetch ?? fetch)(
    `${options.baseUrl ?? "https://api.paystack.co"}/transaction/initialize`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reference: input.reference,
        amount: toPesewas(input.amount),
        currency: "GHS",
        email: input.email,
        metadata: input.metadata,
        ...(input.subaccount ? { subaccount: input.subaccount } : {}),
        ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      }),
    },
  );
  const parsed = v.safeParse(checkoutResponseSchema, await response.json().catch(() => undefined));
  if (!response.ok || !parsed.success)
    throw new PaystackError("Paystack could not open a checkout", response.status);
  return { url: parsed.output.data.authorization_url };
}
