import * as v from "valibot";

const TIN = /^(?:[A-Z]\d{10}|GHA-\d{9}-\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const taxSettingsView = v.object({
  tin: v.nullable(v.string()),
  vatRegisteredFrom: v.nullable(v.string()),
  priceMode: v.picklist(["inclusive", "exclusive"]),
  cashRounding: v.picklist(["none", "10p"]),
});
export type TaxSettingsView = v.InferOutput<typeof taxSettingsView>;

/** The form: registration is a switch; the TIN and the date it started are needed only while it is on. */
export const taxFormSchema = v.pipe(
  v.object({
    registered: v.boolean(),
    tin: v.pipe(v.string(), v.trim(), v.toUpperCase()),
    vatRegisteredFrom: v.string(),
    priceMode: v.picklist(["inclusive", "exclusive"]),
    cashRounding: v.picklist(["none", "10p"]),
  }),
  v.forward(
    v.check(
      (values) => !values.registered || TIN.test(values.tin),
      "Enter the TIN as on the VAT certificate, like C0012345678 or GHA-123456789-0",
    ),
    ["tin"],
  ),
  v.forward(
    v.check(
      (values) => !values.registered || DATE.test(values.vatRegisteredFrom),
      "Enter the date VAT registration started",
    ),
    ["vatRegisteredFrom"],
  ),
);
export type TaxValues = v.InferInput<typeof taxFormSchema>;

export const taxValues = (settings: TaxSettingsView): TaxValues => ({
  registered: settings.vatRegisteredFrom !== null,
  tin: settings.tin ?? "",
  vatRegisteredFrom: settings.vatRegisteredFrom ?? "",
  priceMode: settings.priceMode,
  cashRounding: settings.cashRounding,
});

export const toTaxBody = (values: TaxValues): TaxSettingsView => ({
  tin: values.tin.trim() ? values.tin.trim().toUpperCase() : null,
  vatRegisteredFrom: values.registered ? values.vatRegisteredFrom : null,
  priceMode: values.priceMode,
  cashRounding: values.cashRounding,
});
