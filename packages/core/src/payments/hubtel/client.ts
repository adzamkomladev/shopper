import * as v from "valibot";
import { fromDecimal, toDecimal, wholePesewas } from "@shopper/money";
import type { ChargeResult } from "../paystack/schemas/base";
import type { PaystackCharge } from "../paystack/types";
import { HUBTEL_CHANNELS, receiveResponseSchema, statusResponseSchema } from "./schemas/base";
import type { HubtelOptions } from "./types";

export class HubtelError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "HubtelError";
  }
}

/**
 * Hubtel's Receive Money (mobile money) and transaction status APIs. Hubtel works in decimal cedis, so amounts
 * leave as `toDecimal(2)` and come back through `fromDecimal`. There is no OTP step: the payer approves on the phone.
 */
export function createHubtel({
  clientId,
  clientSecret,
  merchantAccount,
  callbackUrl,
  baseUrl = "https://rmp.hubtel.com",
  statusUrl = "https://api-txnstatus.hubtel.com",
  fetch: fetcher = fetch,
}: HubtelOptions) {
  const authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  const account = encodeURIComponent(merchantAccount);

  return {
    async charge(input: PaystackCharge): Promise<ChargeResult> {
      // The amount is spliced in as a JSON number literal so its decimal digits never pass through a float.
      const body = JSON.stringify({
        CustomerName: "Shopper customer",
        CustomerMsisdn: `233${input.phone.slice(1)}`,
        CustomerEmail: input.email,
        Channel: HUBTEL_CHANNELS[input.network],
        Amount: "__AMOUNT__",
        PrimaryCallbackUrl: callbackUrl,
        Description: "Shopper sale",
        ClientReference: input.reference,
      }).replace('"__AMOUNT__"', toDecimal(wholePesewas(input.amount), 2));
      const response = await fetcher(
        `${baseUrl}/merchantaccount/merchants/${account}/receivemoney/mobilemoney`,
        { method: "POST", headers: { authorization, "content-type": "application/json" }, body },
      );
      const parsed = v.safeParse(
        receiveResponseSchema,
        await response.json().catch(() => undefined),
      );
      if (!parsed.success) throw new HubtelError("Unexpected Hubtel response", response.status);
      const reply = parsed.output;
      const message = reply.Data?.Description ?? reply.Message ?? undefined;
      // 0001: accepted and waiting for the payer; 0000: already paid; anything else is refused.
      if (reply.ResponseCode === "0001" || reply.ResponseCode === "0000")
        return {
          status: reply.ResponseCode === "0000" ? "confirmed" : "pending",
          ...(reply.Data?.TransactionId ? { providerReference: reply.Data.TransactionId } : {}),
          ...(message ? { message } : {}),
        };
      if (response.status >= 500)
        throw new HubtelError(message ?? "Hubtel unavailable", response.status);
      return { status: "failed", message: message ?? "Hubtel declined the payment" };
    },

    /** The authoritative state of a charge, with the amount Hubtel collected. */
    async verify(
      reference: string,
    ): Promise<ChargeResult & { amount?: ReturnType<typeof fromDecimal> }> {
      const response = await fetcher(
        `${statusUrl}/transactions/${account}/status?clientReference=${encodeURIComponent(reference)}`,
        { headers: { authorization } },
      );
      const parsed = v.safeParse(
        statusResponseSchema,
        await response.json().catch(() => undefined),
      );
      if (!parsed.success)
        throw new HubtelError("Unexpected Hubtel status response", response.status);
      const data = parsed.output.data;
      if (!data) return { status: "pending" };
      return {
        status:
          data.status === "Paid" ? "confirmed" : data.status === "Unpaid" ? "pending" : "failed",
        amount: fromDecimal(data.amount.toFixed(2)),
        ...(data.transactionId ? { providerReference: data.transactionId } : {}),
      };
    },
  };
}
