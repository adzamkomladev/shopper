import * as v from "valibot";
import { draftScope } from "./drafts";
import { tillId } from "./fields";
export const purchaseFilters = {
  status: v.optional(v.picklist(["all", "completed", "returned", "voided", "pending"]), "all"),
  query: v.optional(v.pipe(v.string(), v.maxLength(100)), ""),
  kind: v.optional(v.picklist(["all", "cash", "momo", "card", "credit", "loyalty"]), "all"),
  page: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1)), 1),
  pageSize: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(100)), 20),
};
export const purchasesInput = v.object({ scope: draftScope, at: v.date(), ...purchaseFilters });
export const purchaseInput = v.object({ scope: draftScope, at: v.date(), saleId: tillId });
