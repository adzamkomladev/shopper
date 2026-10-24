import * as v from "valibot";

const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
/** A VAT period: one calendar month, YYYY-MM. */
export const vatPeriodSchema = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/));
/** The input tax the accountant claims for a period, in money units (1 GHS = 10000). */
export const vatReturnInput = v.strictObject({ vat: amount, nhil: amount, getfund: amount });
/** A summary range: Accra dates, grouped by day or month, optionally for one branch. */
export const taxSummaryQuery = v.object({
  from: v.pipe(v.string(), v.isoDate()),
  to: v.pipe(v.string(), v.isoDate()),
  group: v.optional(v.picklist(["day", "month"]), "day"),
  branchId: v.optional(v.pipe(v.string(), v.uuid())),
});
export type TaxRange = v.InferOutput<typeof taxSummaryQuery>;
