import * as v from "valibot";
import { branchView, priceView } from "@shopper/core/schemas";

export const branchList = v.array(branchView);

export const deletedBarcode = v.null();

export const scheduledPrice = v.object({ price: priceView });
