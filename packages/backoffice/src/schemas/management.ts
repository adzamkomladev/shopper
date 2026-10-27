import "./catalogue";
import * as v from "valibot";
import { branchInput, storeInput } from "@shopper/core/schemas";
import { fromDecimal, toDecimal, type Money } from "@shopper/money";
import {
  emptyPhones,
  isRepeated,
  phoneField,
  phoneList,
  phoneValues,
  REPEAT_ERROR,
} from "./branches";
// Loading the catalogue schema also installs the plain-English validation messages the shared schemas need.

const id = v.string();
export const storeView = v.object({
  id,
  name: v.string(),
  cashRoundingStep: v.number(),
  // PostgreSQL answers "07:00:00"; the form edits "07:00".
  opensAt: v.pipe(
    v.string(),
    v.transform((time) => time.slice(0, 5)),
  ),
  closesAt: v.pipe(
    v.string(),
    v.transform((time) => time.slice(0, 5)),
  ),
  createdAt: v.string(),
});
export const branchView = v.object({
  id,
  name: v.string(),
  storeId: id,
  alertPhones: v.optional(v.array(v.string()), []),
  createdAt: v.string(),
});
export type StoreView = v.InferOutput<typeof storeView>;
export type BranchView = v.InferOutput<typeof branchView>;

const { name } = storeInput.entries;
const DEFAULT_STEP = "0.01";

const time = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 07:00"));

export const storeFormSchema = v.pipe(
  v.object({
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
    opensAt: time,
    closesAt: time,
  }),
  v.forward(
    v.partialCheck(
      [["opensAt"], ["closesAt"]],
      (values) => values.closesAt > values.opensAt,
      "The store must close after it opens",
    ),
    ["closesAt"],
  ),
);
export type StoreValues = v.InferInput<typeof storeFormSchema>;

export const emptyStore: StoreValues = {
  name: "",
  cashRounding: DEFAULT_STEP,
  opensAt: "07:00",
  closesAt: "21:00",
};
export const storeValues = (store: StoreView): StoreValues => ({
  name: store.name,
  cashRounding: toDecimal(store.cashRoundingStep as Money),
  opensAt: store.opensAt,
  closesAt: store.closesAt,
});

export function toStoreBody({ name, cashRounding, opensAt, closesAt }: StoreValues) {
  return v.parse(storeInput, {
    name,
    cashRoundingStep: fromDecimal(cashRounding.trim()),
    opensAt,
    closesAt,
  });
}

export const branchFormSchema = v.pipe(
  v.object({
    name: branchInput.entries.name,
    storeId: v.pipe(v.string(), v.nonEmpty("Choose a store")),
    alertPhone1: phoneField,
    alertPhone2: phoneField,
    alertPhone3: phoneField,
  }),
  v.forward(
    v.check((values) => !isRepeated(values, "alertPhone2"), REPEAT_ERROR),
    ["alertPhone2"],
  ),
  v.forward(
    v.check((values) => !isRepeated(values, "alertPhone3"), REPEAT_ERROR),
    ["alertPhone3"],
  ),
);
export type BranchValues = v.InferInput<typeof branchFormSchema>;

export const emptyBranch = (storeId = ""): BranchValues => ({
  name: "",
  storeId,
  ...emptyPhones(),
});
export const branchValues = (
  branch: Pick<BranchView, "name" | "storeId" | "alertPhones">,
): BranchValues => ({
  name: branch.name,
  storeId: branch.storeId,
  ...phoneValues(branch.alertPhones),
});

export function toBranchBody(values: BranchValues) {
  const { name, storeId } = values;
  return v.parse(branchInput, { name, storeId, alertPhones: phoneList(values) });
}
