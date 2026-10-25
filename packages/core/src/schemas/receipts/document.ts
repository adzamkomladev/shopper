import * as v from "valibot";
import { money } from "@shopper/money";
import { taxClassSchema } from "@shopper/tax";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const nonnegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money));
const body = {
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
      kind: v.picklist(["cash", "momo", "card", "credit", "loyalty"]),
      amount: nonnegative,
      reference: v.nullable(v.string()),
      approvalCode: v.nullable(v.string()),
      phone: v.nullable(v.pipe(v.string(), v.regex(/^\*+\d{4}$/))),
      last4: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}$/))),
    }),
  ),
  footer: v.string(),
};
const v3 = {
  /** A refund is a credit note; `refundOf` is the receipt number of the sale it returns. */
  kind: v.picklist(["sale", "refund"]),
  refundOf: v.nullable(v.string()),
  /** Who the invoice is made out to: set only for a customer with a TIN, null for a walk-in. */
  buyer: v.nullable(v.strictObject({ name: v.string(), tin: v.string() })),
  ...body,
};
const v4 = {
  ...v3,
  header: v.strictObject({
    ...body.header.entries,
    /** True when the shop was VAT-registered on the day: the document is a VAT invoice and prints the TIN. */
    vatInvoice: v.boolean(),
  }),
  lines: v.array(
    v.strictObject({
      ...body.lines.item.entries,
      /** The line's amount before tax, shown to a VAT buyer; null on receipts from before v4. */
      net: v.nullable(amount),
    }),
  ),
};
/** The GRA SDC's signature. A VAT invoice without one is provisional; it is added once the SDC accepts. */
export const receiptFiscal = v.strictObject({
  sdcId: v.string(),
  counter: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  signature: v.string(),
  qr: v.string(),
  signedAt: v.pipe(v.string(), v.isoTimestamp()),
});
const current = v.strictObject({ v: v.literal(5), ...v4, fiscal: v.nullable(receiptFiscal) });
type Current = v.InferOutput<typeof current>;
/** Before v5 nothing was signed: a stored v4 receipt is provisional, or not a VAT invoice at all. */
const upcastV4 = v.pipe(
  v.strictObject({ v: v.literal(4), ...v4 }),
  v.transform((receipt): Current => ({ ...receipt, v: 5, fiscal: null })),
);
/** v3 had no VAT invoice flag (every shop was registered) and no net per line; a v3 refund had no own number. */
const upcastV3 = v.pipe(
  v.strictObject({ v: v.literal(3), ...v3 }),
  v.transform((receipt): Current => ({
    ...receipt,
    v: 5,
    header: { ...receipt.header, vatInvoice: true },
    lines: receipt.lines.map((line) => ({ ...line, net: null })),
    fiscal: null,
  })),
);
/** v2 had no buyer: every stored v2 receipt is to a walk-in. */
const upcastV2 = v.pipe(
  v.strictObject({
    v: v.literal(2),
    kind: v.picklist(["sale", "refund"]),
    refundOf: v.nullable(v.string()),
    ...body,
  }),
  v.transform(({ v: _version, ...rest }) => v.parse(upcastV3, { v: 3, buyer: null, ...rest })),
);
/** v1 had no refunds: every stored v1 receipt is a sale. */
const upcastV1 = v.pipe(
  v.strictObject({ v: v.literal(1), ...body }),
  v.transform(({ v: _version, ...rest }) =>
    v.parse(upcastV3, { v: 3, kind: "sale", refundOf: null, buyer: null, ...rest }),
  ),
);
export const receiptDocument = v.union([current, upcastV4, upcastV3, upcastV2, upcastV1]);
export type ReceiptDocument = v.InferOutput<typeof receiptDocument>;
