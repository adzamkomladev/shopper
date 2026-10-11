import * as v from "valibot";
import { uuidV7Schema as managementId } from "@shopper/ports";
import { name } from "./fields";

export { managementId };
const rounding = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
export const storeInput = v.strictObject({ name, cashRoundingStep: v.optional(rounding) });
export const storePatch = v.strictObject({
  name: v.optional(name),
  cashRoundingStep: v.optional(rounding),
});
export const branchInput = v.strictObject({ name, storeId: managementId });
export const branchPatch = v.strictObject({
  name: v.optional(name),
  storeId: v.optional(managementId),
});
