import * as v from "valibot";
import { PaystackError } from "./errors";
import { banksResponseSchema, subaccountResponseSchema } from "./schemas/subaccounts";
import type { PaystackOptions } from "./types";

/** Every GHS bank and mobile money provider Paystack settles to. */
export async function fetchBanks(options: PaystackOptions) {
  const json = await request(options, "/bank?currency=GHS&perPage=200");
  return parse(banksResponseSchema, json).data.map((bank) => ({
    name: bank.name,
    code: bank.code,
    type: bank.type,
  }));
}

/**
 * A subaccount under Shopper's Paystack account that settles the shop's collections to its own account. Shopper
 * keeps no share of a charge, so the percentage is zero.
 */
export async function createSubaccount(
  options: PaystackOptions,
  input: { businessName: string; settlementBank: string; accountNumber: string },
) {
  const json = await request(options, "/subaccount", {
    business_name: input.businessName,
    settlement_bank: input.settlementBank,
    account_number: input.accountNumber,
    percentage_charge: 0,
  });
  return { code: parse(subaccountResponseSchema, json).data.subaccount_code };
}

async function request(options: PaystackOptions, path: string, body?: object) {
  const response = await (options.fetch ?? fetch)(
    `${options.baseUrl ?? "https://api.paystack.co"}${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${options.secretKey}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  return { status: response.status, json: await response.json().catch(() => undefined) };
}

function parse<T extends v.GenericSchema>(schema: T, reply: { status: number; json: unknown }) {
  const parsed = v.safeParse(schema, reply.json);
  if (parsed.success) return parsed.output as v.InferOutput<T>;
  const message = (reply.json as { message?: unknown } | undefined)?.message;
  throw new PaystackError(
    typeof message === "string" ? message : "Unexpected Paystack response",
    reply.status,
  );
}
