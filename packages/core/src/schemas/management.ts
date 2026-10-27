import * as v from "valibot";
import { uuidV7Schema as managementId } from "@shopper/ports";
import { ghanaPhone, name } from "./fields";

export { managementId };
const rounding = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
/** A time of day in Accra (UTC all year), to the minute. */
const hour = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"));
const storeFields = {
  cashRoundingStep: v.optional(rounding),
  opensAt: v.optional(hour),
  closesAt: v.optional(hour),
};
export const storeInput = v.strictObject({ name, ...storeFields });
export const storePatch = v.strictObject({ name: v.optional(name), ...storeFields });
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
