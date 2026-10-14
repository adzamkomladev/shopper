import * as v from "valibot";
import { productInput, productPatch } from "@shopper/core/schemas";
import { fromDecimal } from "@shopper/money";
import { ApiError } from "../api/client";
import { parseShopTime } from "../lib/shop/time";
// Loading the catalogue schema also installs the plain-English validation messages the shared schemas need.
import { messageOfError } from "./catalogue";

export const ALL_BRANCHES = "all";
export type PriceMode = "set" | "schedule";

const { name, sku, baseUnit, taxClass, categoryId } = productInput.entries;
export const detailsSchema = v.object({
  name,
  sku,
  baseUnit,
  taxClass,
  categoryId,
  onlineVisible: v.boolean(),
});
export type DetailsValues = v.InferInput<typeof detailsSchema>;
export const DETAILS_FIELDS = ["name", "sku"];

export function toDetailsBody(values: DetailsValues) {
  return v.parse(productPatch, values);
}

export const barcodeSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.nonEmpty("Enter or scan a barcode"), v.maxLength(64)),
  quantity: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[1-9]\d{0,5}$/, "Use a whole number, 1 or more"),
  ),
});
export type BarcodeValues = v.InferInput<typeof barcodeSchema>;
export const BARCODE_FIELDS = ["code", "quantityThousandths", "barcodes"];
export const emptyBarcode: BarcodeValues = { code: "", quantity: "1" };

export function toBarcodeBody(values: BarcodeValues) {
  const { code, quantity } = v.parse(barcodeSchema, values);
  return { code, quantityThousandths: Number(quantity) * 1000 };
}

const amount = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => {
    try {
      fromDecimal(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount like 12.50"),
  v.transform(fromDecimal),
  v.check((value) => value > 0, "The amount must be more than 0"),
);
const reason = v.pipe(v.string(), v.trim(), v.nonEmpty("Give a reason"), v.maxLength(500));
const branchId = v.pipe(
  v.string(),
  v.transform((value) => (value === ALL_BRANCHES ? undefined : value)),
);
// A datetime-local value has no zone; the API wants an instant.
const instant = v.pipe(
  v.string(),
  v.nonEmpty("Choose a date and time"),
  v.check((value) => !Number.isNaN(parseShopTime(value).getTime()), "Choose a date and time"),
  v.transform((value) => parseShopTime(value).toISOString()),
);

const setPriceSchema = v.object({ amount, branchId, reason });
const schedulePriceSchema = v.pipe(
  v.object({ amount, branchId, reason, startsAt: instant, endsAt: instant }),
  v.forward(
    v.check((price) => price.endsAt > price.startsAt, "The end must be after the start"),
    ["endsAt"],
  ),
  v.forward(
    v.check((price) => Date.parse(price.endsAt) > Date.now(), "The end must be in the future"),
    ["endsAt"],
  ),
);
export const priceSchemas = { set: setPriceSchema, schedule: schedulePriceSchema };
export const PRICE_FIELDS = ["amount", "branchId", "reason", "startsAt", "endsAt"];
export const emptyPrice = {
  amount: "",
  branchId: ALL_BRANCHES,
  reason: "",
  startsAt: "",
  endsAt: "",
};
export type PriceValues = typeof emptyPrice;

export function toPriceBody(mode: PriceMode, values: PriceValues) {
  return v.parse(priceSchemas[mode], values);
}

/** The API's message when it blames one of these inputs, to show under that input. */
export function failureFor(error: Error | null, ...fields: string[]) {
  return error instanceof ApiError && error.field && fields.includes(error.field)
    ? failureMessage(error)
    : undefined;
}

/** What to tell the owner when a write fails. */
export function failureMessage(error: Error) {
  return error instanceof ApiError && error.status === 403
    ? "You don't have permission to change products. Ask the shop owner."
    : messageOfError(error);
}
