import * as v from "valibot";
import { money } from "@shopper/money";
import { taxClassSchema } from "@shopper/tax";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const nonnegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money));
export const receiptDocument = v.strictObject({
  v: v.literal(1),
  saleId: v.string(),
  header: v.strictObject({
    org: v.string(),
    tin: v.nullable(v.string()),
    branch: v.string(),
    address: v.nullable(v.string()),
    device: v.string(),
    cashier: v.string(),
    receiptNumber: v.nullable(v.string()),
    utcTime: v.pipe(v.string(), v.isoTimestamp()),
    accraTime: v.string(),
    timeZone: v.literal("Africa/Accra"),
  }),
  lines: v.array(
    v.strictObject({
      name: v.string(),
      quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
      unit: v.picklist(["each", "kg", "g", "l", "ml"]),
      unitPrice: nonnegative,
      discount: nonnegative,
      gross: nonnegative,
      taxClass: taxClassSchema,
    }),
  ),
  taxSummary: v.strictObject({
    net: amount,
    nhil: amount,
    getfund: amount,
    covid: amount,
    vat: amount,
    zeroRatedBase: nonnegative,
    exemptBase: nonnegative,
  }),
  subtotal: nonnegative,
  discountTotal: nonnegative,
  gross: nonnegative,
  cashRounding: amount,
  total: nonnegative,
  paid: nonnegative,
  change: nonnegative,
  tenders: v.array(
    v.strictObject({
      kind: v.picklist(["cash", "momo", "card"]),
      amount: nonnegative,
      reference: v.nullable(v.string()),
      approvalCode: v.nullable(v.string()),
      phone: v.nullable(v.pipe(v.string(), v.regex(/^\*+\d{4}$/))),
      last4: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}$/))),
    }),
  ),
  footer: v.string(),
});
export type ReceiptDocument = v.InferOutput<typeof receiptDocument>;
