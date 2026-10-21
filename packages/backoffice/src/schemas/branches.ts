import * as v from "valibot";
import { branchInput } from "@shopper/core/schemas";
import { ApiError } from "../api/client";

export const deletedBranch = v.null();

/** Up to three people are texted when stock runs low; the form has one input for each. */
export const PHONE_FIELDS = ["alertPhone1", "alertPhone2", "alertPhone3"] as const;
export type PhoneField = (typeof PHONE_FIELDS)[number];
export type Phones = Record<PhoneField, string>;

export const PHONE_ERROR = "Enter a Ghana mobile number like 024 123 4567";
const alertPhones = branchInput.entries.alertPhones;
const sameNumber = (phone: string) => phone.trim().replace(/^\+?233/, "0");

// An empty input is an unused slot. Any other value must pass the API's own phone rule.
export const phoneField = v.pipe(
  v.string(),
  v.trim(),
  v.check((phone) => phone === "" || v.is(alertPhones, [phone]), PHONE_ERROR),
);

export const REPEAT_ERROR = "This number is already listed above";

/** Whether an earlier input already holds this number, in any of its +233, 233 or 0 spellings. */
export function isRepeated(phones: Phones, field: PhoneField) {
  const mine = sameNumber(phones[field]);
  const earlier = PHONE_FIELDS.slice(0, PHONE_FIELDS.indexOf(field));
  return mine !== "" && earlier.some((other) => sameNumber(phones[other]) === mine);
}

export const emptyPhones = (): Phones => ({ alertPhone1: "", alertPhone2: "", alertPhone3: "" });

export const phoneValues = (phones: readonly string[]): Phones => ({
  ...emptyPhones(),
  ...Object.fromEntries(phones.slice(0, PHONE_FIELDS.length).map((p, i) => [PHONE_FIELDS[i], p])),
});

/** The filled inputs in order, so clearing the first moves the others up. */
export const phoneList = (phones: Phones) =>
  PHONE_FIELDS.map((field) => phones[field].trim()).filter(Boolean);

/** The input an API error is about: the body field is "alertPhones.1" for the second number. */
export function phoneFieldOfError(error: unknown) {
  if (!(error instanceof ApiError)) return undefined;
  const index = /^alertPhones\.(\d+)$/.exec(error.field ?? "")?.[1];
  return index === undefined ? undefined : PHONE_FIELDS[Number(index)];
}
