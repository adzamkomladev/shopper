import { hmacHex } from "../links/tokens";
import type { KycIdType } from "./types";

/** The shape each ID number must have once normalized. Every type is verified by hand, so these only catch typos. */
export const idFormats: Record<KycIdType, RegExp> = {
  ghana_card: /^GHA-\d{9}-\d$/,
  passport: /^[A-Z0-9]{6,9}$/,
  voter_id: /^\d{10}$/,
  drivers_licence: /^[A-Z0-9-]{6,20}$/,
};

/** Case and spaces carry no meaning in an ID number; the fingerprint and the mask both work on this form. */
export const normalizeId = (number: string) => number.replace(/\s+/g, "").toUpperCase();

export const isValidId = (type: KycIdType, number: string) =>
  idFormats[type].test(normalizeId(number));

/** What may be shown to an approver: the Ghana Card keeps its prefix and check digit, the rest only its last two characters. */
export function maskId(type: KycIdType, number: string) {
  const id = normalizeId(number);
  if (type === "ghana_card") return id.replace(/^(GHA-)\d{7}(\d{2}-\d)$/, "$1•••••••$2");
  return "•".repeat(Math.max(id.length - 2, 0)) + id.slice(-2);
}

/** The only stored form of an ID number besides the mask: equal numbers give equal digests, nothing else can be told. */
export const idDigest = (secret: string, type: KycIdType, number: string) =>
  hmacHex(secret, `shopper:kyc-id:${type}:${normalizeId(number)}`);
