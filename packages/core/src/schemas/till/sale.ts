import * as v from "valibot";
import { money } from "@shopper/money";
import { tillId } from "./fields";
import { dateSchema, taxClassSchema, taxRuleSchema } from "@shopper/tax";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const nonnegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money));
export const saleTotals = v.strictObject({
  base: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
  gross: amount,
  roundingAdjustment: amount,
});
export const saleTaxSnapshot = v.strictObject({
  ...saleTotals.entries,
  rule: v.strictObject({ ...taxRuleSchema.entries, id: tillId }),
  on: dateSchema,
  taxClass: taxClassSchema,
  priceMode: v.picklist(["inclusive", "exclusive"]),
  quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  unitPrice: nonnegative,
  discount: nonnegative,
});
export const saleSnapshot = v.strictObject({
  id: tillId,
  localId: tillId,
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  cashierId: tillId,
  sessionId: tillId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  deviceTime: v.pipe(v.string(), v.isoTimestamp()),
  lines: v.pipe(
    v.array(
      v.strictObject({
        id: tillId,
        productId: tillId,
        priceId: tillId,
        sku: v.string(),
        name: v.string(),
        baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
        tax: saleTaxSnapshot,
      }),
    ),
    v.minLength(1),
  ),
  totals: saleTotals,
});
export const saleEvent = v.strictObject({
  v: v.literal(1),
  type: v.literal("sale.recorded"),
  sale: saleSnapshot,
});
export const recordSaleInput = v.strictObject({
  lines: v.pipe(
    v.array(
      v.strictObject({
        productId: tillId,
        quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
      }),
    ),
    v.minLength(1),
  ),
});
export type SaleEvent = v.InferOutput<typeof saleEvent>;
export type SaleSnapshot = v.InferOutput<typeof saleSnapshot>;
