import * as v from "valibot";
import { productInput } from "@shopper/core/schemas";
import { ApiError } from "../../api/client";

// The shared schemas carry Valibot's English defaults; these are what the shop owner reads.
v.setSpecificMessage(v.minLength, "Required");
v.setSpecificMessage(v.maxLength, (issue) => `Use ${issue.requirement} characters or fewer`);
v.setSpecificMessage(v.picklist, "Choose an option");

const { name, sku, baseUnit, taxClass, categoryId } = productInput.entries;

/** The sheet's fields. The API takes a barcode list; the sheet offers one optional barcode. */
export const newProductSchema = v.object({
  name,
  sku,
  baseUnit,
  taxClass,
  categoryId,
  barcode: v.pipe(v.string(), v.trim(), v.maxLength(64)),
});
export type NewProductValues = v.InferInput<typeof newProductSchema>;
const FIELDS = ["name", "sku", "baseUnit", "taxClass", "categoryId", "barcode"] as const;
export type NewProductField = (typeof FIELDS)[number];

export const emptyProduct: NewProductValues = {
  name: "",
  sku: "",
  baseUnit: "each",
  taxClass: "standard",
  categoryId: null,
  barcode: "",
};

export function toProductBody({ barcode, ...values }: NewProductValues) {
  return v.parse(productInput, { ...values, barcodes: barcode ? [{ code: barcode }] : [] });
}

/** What to tell the owner; the API says only "Already exists" for a duplicate SKU or barcode. */
export function messageOfError(error: Error) {
  return error instanceof ApiError && error.status === 409
    ? "Another product already uses this"
    : error.message;
}

/** The sheet field an API error belongs to ("barcodes.0.code" is the Barcode field), if any. */
export function fieldOfError(error: unknown): NewProductField | undefined {
  if (!(error instanceof ApiError) || !error.field) return undefined;
  const field = error.field.startsWith("barcodes") ? "barcode" : error.field;
  return FIELDS.find((name) => name === field);
}
