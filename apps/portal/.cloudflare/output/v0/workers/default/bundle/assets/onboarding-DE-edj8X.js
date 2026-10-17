import {
  L as object,
  Q as string,
  U as pipe,
  _ as check,
  j as minLength,
  w as is,
  z as optional,
} from "./react-dom-BCYT53bd.js";
import {
  c as passwordSchema,
  l as personNameSchema,
  o as emailSchema,
  v as shopCodeSchema,
} from "./schemas-DUCUNo6u.js";
//#region ../../packages/backoffice/src/schemas/auth/onboarding.ts
/** Form checks reuse the server's schemas as the rule and only add the sentence a person reads. */
function accepted(schema, message) {
  return pipe(
    string(),
    check((input) => is(schema, input), message),
  );
}
var name = accepted(personNameSchema, "Enter your name");
var email = accepted(emailSchema, "Enter a valid email address");
var shopCode = accepted(
  shopCodeSchema,
  "Use lowercase letters, numbers and hyphens, like ama-mart",
);
var password = accepted(passwordSchema, "Use at least 12 characters");
var signupSchema = object({
  name,
  email,
  shopName: accepted(personNameSchema, "Enter your shop's name"),
  shopCode,
});
var completeSchema = object({
  shopCode,
  password,
});
var joinSchema = object({
  name,
  password,
});
var existingJoinSchema = object({
  name: optional(string()),
  password: pipe(string(), minLength(1, "Enter your password")),
});
var SHOP_CODE_HELP = "Lowercase letters, numbers and hyphens. Staff type it to log in.";
/** A shop code suggested from the shop's name, such as "Ama's Mart" -> "ama-s-mart". */
function suggestShopCode(shopName) {
  return shopName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
//#endregion
export {
  signupSchema as a,
  joinSchema as i,
  completeSchema as n,
  suggestShopCode as o,
  existingJoinSchema as r,
  SHOP_CODE_HELP as t,
};
