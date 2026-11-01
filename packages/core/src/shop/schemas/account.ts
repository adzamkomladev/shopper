import * as v from "valibot";
import { shopPhone } from "./signin";

/** Trimmed text a shopper typed; blank means "not kept". */
const optionalText = (max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(max, `Keep it under ${max} characters`),
    v.transform((text) => text || null),
  );
const requiredText = (max: number, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(message),
    v.maxLength(max, `Keep it under ${max} characters`),
  );

export const shopProfileInput = v.object({
  name: v.optional(optionalText(80)),
  email: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.toLowerCase(),
      v.check(
        (email) => email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        "Enter a valid email",
      ),
      v.maxLength(254),
      v.transform((email) => email || null),
    ),
  ),
});

const addressFields = {
  label: requiredText(40, "Name this address, like Home or Work"),
  line1: requiredText(120, "Enter the street or house"),
  area: requiredText(80, "Enter the area"),
  city: requiredText(80, "Enter the town or city"),
  landmark: v.optional(v.nullable(optionalText(120))),
  phone: shopPhone,
  isDefault: v.optional(v.boolean()),
};

export const shopAddressInput = v.object(addressFields);
export const shopAddressPatch = v.partial(v.object(addressFields));
