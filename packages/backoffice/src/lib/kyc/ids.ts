import type { IdType } from "./types";

export const ID_TYPES = [
  "ghana_card",
  "passport",
  "voter_id",
  "drivers_licence",
] as const satisfies readonly IdType[];

export const ID_LABELS: Record<IdType, string> = {
  ghana_card: "Ghana Card",
  passport: "Passport",
  voter_id: "Voter ID",
  drivers_licence: "Driver's licence",
};

// The shapes the API accepts (packages/auth/src/kyc/documents.ts), repeated here so a typo is caught before
// the request: the auth KYC module is server-only. The API stays the judge.
const FORMATS: Record<IdType, RegExp> = {
  ghana_card: /^GHA-\d{9}-\d$/,
  passport: /^[A-Z0-9]{6,9}$/,
  voter_id: /^\d{10}$/,
  drivers_licence: /^[A-Z0-9-]{6,20}$/,
};

/** Case and spaces carry no meaning in an ID number. */
export const normalizeId = (number: string) => number.replace(/\s+/g, "").toUpperCase();

export const isValidId = (type: IdType, number: string) => FORMATS[type].test(normalizeId(number));
