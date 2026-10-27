import { money, toPesewas, wholePesewas, type Money } from "@shopper/money";
import * as v from "valibot";
import {
  chargeResponseSchema,
  errorResponseSchema,
  PROVIDER_CODES,
  refundResponseSchema,
  verifyResponseSchema,
  type ChargeResult,
  type RefundResult,
} from "./schemas/base";
import type { PaystackCharge, PaystackOptions } from "./types";

const PESEWA = 100;

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

type Reply = { status: number; json: unknown };

export function createPaystack({
  secretKey,
  baseUrl = "https://api.paystack.co",
  fetch: fetcher = fetch,
}: PaystackOptions) {
  async function call(path: string, body?: object): Promise<Reply> {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${secretKey}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, json: await response.json().catch(() => undefined) };
  }

  return {
    async charge(input: PaystackCharge): Promise<ChargeResult> {
      if (money(input.amount) % PESEWA !== 0)
        throw new RangeError("Mobile money amounts must be whole pesewas");
      return normaliseCharge(
        await call("/charge", {
          email: input.email,
          amount: toPesewas(input.amount),
          currency: "GHS",
          reference: input.reference,
          mobile_money: { phone: input.phone, provider: PROVIDER_CODES[input.network] },
        }),
      );
    },

    async submitOtp(input: { reference: string; otp: string }): Promise<ChargeResult> {
      return normaliseCharge(await call("/charge/submit_otp", input));
    },

    async verify(reference: string): Promise<ChargeResult> {
      const { data } = parseOrThrow(
        verifyResponseSchema,
        await call(`/transaction/verify/${encodeURIComponent(reference)}`),
      );
      return {
        status: verifiedStatuses[data.status] ?? "pending",
        providerReference: data.reference,
        ...(data.gateway_response ? { message: data.gateway_response } : {}),
      };
    },

    /** Refunds part or all of a settled charge back to the payer's wallet. */
    async refund(input: { reference: string; amount: Money }): Promise<RefundResult> {
      const { data } = parseOrThrow(
        refundResponseSchema,
        await call("/refund", {
          transaction: input.reference,
          amount: toPesewas(wholePesewas(input.amount)),
        }),
      );
      return {
        status: refundStatuses[data.status] ?? "pending",
        providerReference: String(data.id),
      };
    },

    async verifyRefund(id: string): Promise<RefundResult> {
      const { data } = parseOrThrow(
        refundResponseSchema,
        await call(`/refund/${encodeURIComponent(id)}`),
      );
      return {
        status: refundStatuses[data.status] ?? "pending",
        providerReference: String(data.id),
      };
    },
  };
}

const refundStatuses: Partial<Record<string, RefundResult["status"]>> = {
  processed: "processed",
  failed: "failed",
};

// Anything else (abandoned, ongoing, queued, processing) is still unsettled.
const verifiedStatuses: Partial<Record<string, ChargeResult["status"]>> = {
  success: "confirmed",
  failed: "failed",
  reversed: "failed",
};

const chargeStatuses = {
  send_otp: "otp",
  pay_offline: "pending",
  pending: "pending",
  success: "confirmed",
  failed: "failed",
} as const;

function normaliseCharge(reply: Reply): ChargeResult {
  const error = v.safeParse(errorResponseSchema, reply.json);
  // A wrong OTP leaves the charge waiting for another attempt.
  if (error.success && error.output.code === "invalid_otp")
    return { status: "otp", message: error.output.message };
  const { data } = parseOrThrow(chargeResponseSchema, reply);
  const message = data.message ?? data.display_text;
  return {
    status: chargeStatuses[data.status],
    providerReference: data.reference,
    ...(message ? { message } : {}),
  };
}

/** A declined charge is a 400 that still carries `data.status`, so only other replies throw. */
function parseOrThrow<T extends v.GenericSchema>(schema: T, reply: Reply): v.InferOutput<T> {
  const parsed = v.safeParse(schema, reply.json);
  if (parsed.success) return parsed.output;
  const error = v.safeParse(errorResponseSchema, reply.json);
  throw new PaystackError(
    error.success ? error.output.message : "Unexpected Paystack response",
    reply.status,
    error.success ? error.output.code : undefined,
  );
}
