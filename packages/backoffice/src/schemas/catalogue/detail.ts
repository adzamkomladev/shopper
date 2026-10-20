import * as v from "valibot";
import { branchView, priceView } from "@shopper/core/schemas";

// Branch settings read the whole row, so the list carries the alert phones the price labels ignore.
export const branchList = v.array(
  v.object({ ...branchView.entries, alertPhones: v.optional(v.array(v.string()), []) }),
);

export const deletedBarcode = v.null();

export const scheduledPrice = v.object({ price: priceView });
