import * as v from "valibot";
import { tillId } from "./fields";

const amount = v.pipe(v.number(), v.safeInteger());
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

export const registerReportInput = v.pipe(
  v.object({ from: v.pipe(v.string(), v.isoDate()), to: v.pipe(v.string(), v.isoDate()) }),
  v.check((r) => r.from <= r.to, "The range must not end before it starts"),
);

export const registerReportSchema = v.strictObject({
  from: v.string(),
  to: v.string(),
  totals: v.strictObject({
    sales: amount,
    transactions: count,
    tax: amount,
    discounts: amount,
    net: amount,
  }),
  tenders: v.array(v.strictObject({ method: v.picklist(["cash", "momo", "card"]), amount })),
  byHour: v.array(
    v.strictObject({
      hour: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(23)),
      amount,
      count,
    }),
  ),
  topProducts: v.array(
    v.strictObject({ productId: tillId, name: v.string(), quantityThousandths: count, amount }),
  ),
  returns: v.strictObject({ count, amount }),
  products: count,
  discountedSales: count,
});

export type RegisterReport = v.InferOutput<typeof registerReportSchema>;
