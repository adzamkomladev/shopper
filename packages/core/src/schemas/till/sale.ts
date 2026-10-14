import * as v from "valibot";
import { money } from "@shopper/money";
import { createEventDecoder } from "../events";
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
const saleSnapshotV1 = v.strictObject({
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
export const saleSnapshot = v.strictObject({
  ...saleSnapshotV1.entries,
  receiptNumber: v.nullable(v.pipe(v.string(), v.regex(/^BR[0-9]+-T[0-9]+-X?[0-9]{6,}$/))),
  receiptOverflow: v.boolean(),
  clockOffsetMs: v.pipe(v.number(), v.safeInteger()),
});
export const saleEvent = v.strictObject({
  v: v.literal(2),
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

const saleEventV1 = v.strictObject({
  v: v.literal(1),
  type: v.literal("sale.recorded"),
  sale: saleSnapshotV1,
});
export const decodeSaleEvent = createEventDecoder(2, (raw) => v.parse(saleEvent, raw), {
  1(raw) {
    const old = v.parse(saleEventV1, raw);
    return {
      ...old,
      v: 2,
      sale: { ...old.sale, receiptNumber: null, receiptOverflow: false, clockOffsetMs: 0 },
    };
  },
});
