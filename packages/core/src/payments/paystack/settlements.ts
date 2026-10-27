import * as v from "valibot";
import { fromPesewas } from "@shopper/money";
import { PaystackError } from "./errors";
import { pageOf, payoutLineSchema, payoutSchema } from "./schemas/settlements";
import type { PaystackOptions, PaystackSettlement } from "./types";

const PER_PAGE = 100;

/** Every Paystack payout settled between two Accra dates, each with the charges it paid out. */
export async function fetchSettlements(
  options: PaystackOptions,
  range: { from: string; to: string },
): Promise<PaystackSettlement[]> {
  const payouts = await pages(
    options,
    payoutSchema,
    (page) => `/settlement?from=${range.from}&to=${range.to}&perPage=${PER_PAGE}&page=${page}`,
  );
  return Promise.all(
    payouts.map(async (payout) => ({
      providerId: String(payout.id),
      settledOn: payout.settlement_date.slice(0, 10),
      amount: fromPesewas(payout.total_amount),
      fees: fromPesewas(payout.total_fees),
      lines: (
        await pages(
          options,
          payoutLineSchema,
          (page) =>
            `/settlement/${encodeURIComponent(String(payout.id))}/transactions?perPage=${PER_PAGE}&page=${page}`,
        )
      ).map((line) => ({
        reference: line.reference,
        amount: fromPesewas(line.amount),
        fee: fromPesewas(line.fees),
      })),
    })),
  );
}

async function pages<T extends v.GenericSchema>(
  options: PaystackOptions,
  item: T,
  path: (page: number) => string,
  page = 1,
): Promise<v.InferOutput<T>[]> {
  const response = await (options.fetch ?? fetch)(
    `${options.baseUrl ?? "https://api.paystack.co"}${path(page)}`,
    { headers: { authorization: `Bearer ${options.secretKey}` } },
  );
  const parsed = v.safeParse(pageOf(item), await response.json().catch(() => undefined));
  if (!parsed.success) throw new PaystackError("Unexpected Paystack response", response.status);
  if (parsed.output.meta.page >= parsed.output.meta.pageCount) return parsed.output.data;
  return [...parsed.output.data, ...(await pages(options, item, path, page + 1))];
}
