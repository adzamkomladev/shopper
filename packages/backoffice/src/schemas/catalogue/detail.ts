import * as v from "valibot";
import { branchView, priceView } from "@shopper/core/schemas";

// Branch settings read the whole row, so the list carries the alert phones the price labels ignore.
export const branchList = v.array(
  v.object({ ...branchView.entries, alertPhones: v.optional(v.array(v.string()), []) }),
);

export const deletedBarcode = v.null();

export const scheduledPrice = v.object({ price: priceView });

/** A short link to the product's photo, or null when it has none. */
export const productImageLink = v.object({ url: v.nullable(v.string()) });
export const productImageSet = v.object({ assetId: v.nullable(v.string()) });
