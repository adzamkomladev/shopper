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

export const codeStep = v.object({
  code: v.pipe(
    v.string(),
    v.trim(),
    v.regex(
      /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/,
      "Enter the 12-character code the installer printed",
    ),
  ),
});
export const shopStep = v.object({
  shopName: accepted(personNameSchema, "Enter your shop's name"),
  shopCode: accepted(shopCodeSchema, "Use lowercase letters, numbers and hyphens, like ama-mart"),
  storeName: accepted(personNameSchema, "Enter your first store's name"),
});
export const ownerStep = v.object({
  name: accepted(personNameSchema, "Enter the owner's name"),
  email: accepted(emailSchema, "Enter a valid email address"),
  password: accepted(passwordSchema, "Use at least 12 characters"),
});
export const licenceStep = v.object({
  licence: v.pipe(
    v.string(),
    v.check((text) => {
      try {
        return typeof JSON.parse(text) === "object";
      } catch {
        return false;
      }
    }, "Paste the whole contents of licence.json"),
  ),
});

export type InstallValues = v.InferOutput<typeof codeStep> &
  v.InferOutput<typeof shopStep> &
  v.InferOutput<typeof ownerStep> & { licence?: string };
