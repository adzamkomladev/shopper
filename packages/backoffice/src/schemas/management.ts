import "./catalogue";
import * as v from "valibot";
import { branchInput, storeInput } from "@shopper/core/schemas";
import { fromDecimal, toDecimal, type Money } from "@shopper/money";
// Loading the catalogue schema also installs the plain-English validation messages the shared schemas need.

const id = v.string();
export const storeView = v.object({
  id,
  name: v.string(),
  cashRoundingStep: v.number(),
  createdAt: v.string(),
});
export const branchView = v.object({ id, name: v.string(), storeId: id, createdAt: v.string() });
export type StoreView = v.InferOutput<typeof storeView>;
export type BranchView = v.InferOutput<typeof branchView>;

const { name } = storeInput.entries;
const DEFAULT_STEP = "0.01";

export const storeFormSchema = v.object({
  name,
  cashRounding: v.pipe(
    v.string(),
    v.trim(),
    v.check((value) => {
      try {
        return fromDecimal(value) > 0;
      } catch {
        return false;
      }
    }, "Enter an amount like 0.05"),
  ),
});
export type StoreValues = v.InferInput<typeof storeFormSchema>;

export const emptyStore: StoreValues = { name: "", cashRounding: DEFAULT_STEP };
export const storeValues = (store: StoreView): StoreValues => ({
  name: store.name,
  cashRounding: toDecimal(store.cashRoundingStep as Money),
});

export function toStoreBody({ name, cashRounding }: StoreValues) {
  return v.parse(storeInput, { name, cashRoundingStep: fromDecimal(cashRounding.trim()) });
}

export const branchFormSchema = v.object({
  name: branchInput.entries.name,
  storeId: v.pipe(v.string(), v.nonEmpty("Choose a store")),
});
export type BranchValues = v.InferInput<typeof branchFormSchema>;

export const emptyBranch = (storeId = ""): BranchValues => ({ name: "", storeId });

export function toBranchBody(values: BranchValues) {
  return v.parse(branchInput, values);
}
