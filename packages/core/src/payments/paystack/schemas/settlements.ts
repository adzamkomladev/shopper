import * as v from "valibot";

const pesewas = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** One page of a Paystack list endpoint. */
export const pageOf = <T extends v.GenericSchema>(item: T) =>
  v.object({
    status: v.literal(true),
    data: v.array(item),
    meta: v.object({ page: v.number(), pageCount: v.number() }),
  });

/** A `GET /settlement` item: one payout; amounts are pesewas. */
export const payoutSchema = v.object({
  id: v.union([v.number(), v.string()]),
  settlement_date: v.string(),
  total_amount: pesewas,
  total_fees: v.optional(pesewas, 0),
});

/** A `GET /settlement/:id/transactions` item: a charge the payout settled. */
export const payoutLineSchema = v.object({
  reference: v.string(),
  amount: pesewas,
  fees: v.optional(pesewas, 0),
});
