import * as v from "valibot";
import { uuidV7Schema as managementId } from "@shopper/ports";
import { ghanaPhone, name } from "./fields";

export { managementId };
const rounding = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
export const storeInput = v.strictObject({ name, cashRoundingStep: v.optional(rounding) });
export const storePatch = v.strictObject({
  name: v.optional(name),
  cashRoundingStep: v.optional(rounding),
});
/** Who is texted when stock runs low: up to three distinct numbers. */
const alertPhones = v.pipe(
  v.array(ghanaPhone),
  v.maxLength(3),
  v.check((phones) => new Set(phones).size === phones.length, "Alert phones must be distinct"),
);
export const branchInput = v.strictObject({
  name,
  storeId: managementId,
  alertPhones: v.optional(alertPhones),
});
export const branchPatch = v.strictObject({
  name: v.optional(name),
  storeId: v.optional(managementId),
  alertPhones: v.optional(alertPhones),
});
