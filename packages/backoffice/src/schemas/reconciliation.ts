import * as v from "valibot";

const day = v.pipe(v.string(), v.isoDate());
const amount = v.pipe(v.union([v.number(), v.string()]), v.transform(Number));

export const reconciliationSearch = v.object({ day: v.optional(day) });

export const reconciliationView = v.object({
  day: v.string(),
  tenders: v.array(
    v.object({
      tender: v.string(),
      taken: v.number(),
      expected: v.number(),
      declared: v.number(),
      variance: v.number(),
      settled: v.nullable(v.number()),
    }),
  ),
  shifts: v.array(
    v.object({
      id: v.string(),
      branchId: v.string(),
      deviceId: v.string(),
      closedAt: v.string(),
      closedBy: v.string(),
      tenders: v.array(
        v.object({
          tender: v.string(),
          expected: amount,
          declared: amount,
          variance: amount,
        }),
      ),
    }),
  ),
  momo: v.object({
    unsettled: v.number(),
    mismatches: v.array(
      v.object({
        paymentId: v.string(),
        reference: v.string(),
        expected: v.number(),
        settled: v.number(),
        settledOn: v.nullable(v.string()),
        saleId: v.string(),
        receiptNumber: v.nullable(v.string()),
      }),
    ),
    unapplied: v.number(),
  }),
});
export type ReconciliationView = v.InferOutput<typeof reconciliationView>;

export const refreshStarted = v.object({ started: v.boolean() });
