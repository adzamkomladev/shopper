import * as v from "valibot";
import {
  emailSchema,
  passwordSchema,
  personNameSchema,
  shopCodeSchema,
} from "@shopper/auth/schemas";

/** Form checks reuse the server's schemas as the rule and only add the sentence a person reads. */
function accepted(schema: v.GenericSchema<string>, message: string) {
  return v.pipe(
    v.string(),
    v.check((input) => v.is(schema, input), message),
  );
}

const name = accepted(personNameSchema, "Enter your name");
const email = accepted(emailSchema, "Enter a valid email address");
const shopCode = accepted(
  shopCodeSchema,
  "Use lowercase letters, numbers and hyphens, like ama-mart",
);
const password = accepted(passwordSchema, "Use at least 12 characters");

export const signupSchema = v.object({
  name,
  email,
  shopName: accepted(personNameSchema, "Enter your shop's name"),
  shopCode,
});
export const completeSchema = v.object({ shopCode, password });
export const joinSchema = v.object({ name, password });
export const existingJoinSchema = v.object({
  name: v.optional(v.string()),
  password: v.pipe(v.string(), v.minLength(1, "Enter your password")),
});

export const SHOP_CODE_HELP = "Lowercase letters, numbers and hyphens. Staff type it to log in.";

/** A shop code suggested from the shop's name, such as "Ama's Mart" -> "ama-s-mart". */
export function suggestShopCode(shopName: string) {
  return shopName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
