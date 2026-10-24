import * as v from "valibot";
import { fromDecimal, money, toDecimal } from "@shopper/money";
import { amountField } from "../settings/fields";

const amount = v.pipe(v.number(), v.safeInteger());
const supplies = v.object({
  value: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
});
const parts = v.object({
  base: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
  gross: amount,
});

export const vatReturnView = v.object({
  period: v.string(),
  from: v.string(),
  to: v.string(),
  standard: supplies,
  zeroRated: amount,
  exempt: amount,
  creditNotes: v.object({ ...supplies.entries, zeroRated: amount, exempt: amount }),
  output: v.object({ vat: amount, nhil: amount, getfund: amount, covid: amount }),
  input: v.object({ vat: amount, nhil: amount, getfund: amount }),
  payable: amount,
});
export type VatReturnView = v.InferOutput<typeof vatReturnView>;

export const taxSummaryView = v.object({
  rows: v.array(
    v.object({
      period: v.string(),
      branchId: v.string(),
      branchName: v.string(),
      taxClass: v.picklist(["standard", "zero-rated", "exempt"]),
      sales: parts,
      creditNotes: parts,
    }),
  ),
});
export type TaxSummaryView = v.InferOutput<typeof taxSummaryView>;

/** Cedis to the pesewa, as on a purchase invoice, so what is saved is what the form shows again. */
const cedis = (message: string) =>
  v.pipe(amountField(0, message), v.regex(/^\d+(?:\.\d{1,2})?$/, message));
/** The input tax claimed for the month, typed in cedis. */
export const inputFormSchema = v.object({
  vat: cedis("Enter the input VAT in cedis, 0 if none"),
  nhil: cedis("Enter the input NHIL in cedis, 0 if none"),
  getfund: cedis("Enter the input GETFund levy in cedis, 0 if none"),
});
export type InputValues = v.InferInput<typeof inputFormSchema>;
export const inputValues = (input: VatReturnView["input"]): InputValues => ({
  vat: toDecimal(money(input.vat)),
  nhil: toDecimal(money(input.nhil)),
  getfund: toDecimal(money(input.getfund)),
});
export const toInputBody = (values: InputValues) => ({
  vat: fromDecimal(values.vat.trim()),
  nhil: fromDecimal(values.nhil.trim()),
  getfund: fromDecimal(values.getfund.trim()),
});

/** The month a VAT return covers, YYYY-MM; the screen defaults to last month, the one usually being filed. */
export const returnSearch = v.object({
  period: v.optional(v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/))),
});
/** A summary range in shop dates, grouped by day or month. */
export const summarySearch = v.object({
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  to: v.optional(v.pipe(v.string(), v.isoDate())),
  group: v.optional(v.picklist(["day", "month"])),
});
