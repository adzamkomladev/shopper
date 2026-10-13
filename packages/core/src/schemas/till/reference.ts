import * as v from "valibot";
import { tillId } from "./fields";
import { taxClassSchema, taxRuleSchema } from "@shopper/tax";
import { money } from "@shopper/money";

const timestamp = v.pipe(v.string(), v.isoTimestamp());
export const tillProduct = v.strictObject({
  id: tillId,
  orgId: tillId,
  sku: v.string(),
  name: v.string(),
  baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: taxClassSchema,
  archivedAt: v.nullable(timestamp),
});
export const tillPrice = v.strictObject({
  id: tillId,
  orgId: tillId,
  productId: tillId,
  branchId: v.nullable(tillId),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
  validFrom: timestamp,
  validTo: v.nullable(timestamp),
});
export const tillTaxRule = v.strictObject({
  ...taxRuleSchema.entries,
  id: tillId,
  orgId: tillId,
  source: v.string(),
});
export const tillReference = v.strictObject({
  products: v.array(tillProduct),
  prices: v.array(tillPrice),
  taxRules: v.array(tillTaxRule),
});
