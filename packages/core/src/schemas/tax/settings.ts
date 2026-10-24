import * as v from "valibot";
import { dateSchema } from "@shopper/tax";
import { tinSchema } from "../customers/inputs";
import { cashRoundingSchema } from "../till/reference";

export const priceModeSchema = v.picklist(["inclusive", "exclusive"]);
/** The org's tax settings; a VAT-registered org must give the TIN its invoices carry. */
export const taxSettings = v.pipe(
  v.strictObject({
    tin: v.nullable(tinSchema),
    vatRegisteredFrom: v.nullable(dateSchema),
    priceMode: priceModeSchema,
    cashRounding: cashRoundingSchema,
  }),
  v.check(
    (settings) => settings.vatRegisteredFrom === null || settings.tin !== null,
    "A VAT-registered business needs its TIN",
  ),
);
export type TaxSettings = v.InferOutput<typeof taxSettings>;
