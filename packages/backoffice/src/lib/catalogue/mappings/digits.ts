import type { DigitRange, Kind } from "./types";

/** An EAN-13 label has digits 1 to 13. Digits 1–2 are the prefix, digit 13 the check digit. */
export const FIRST_DATA_DIGIT = 3;
export const LAST_DATA_DIGIT = 12;
const CODE_DIGITS = 13;

/** The digits a field covers, or undefined while its start or length is not a usable number. */
export function rangeOf(start: number, length: number): DigitRange | undefined {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) {
    return undefined;
  }
  return { first: start, last: start + length - 1 };
}

/** "digit 8" or "digits 3–7". */
export const digitsText = ({ first, last }: DigitRange) =>
  first === last ? `digit ${first}` : `digits ${first}–${last}`;

export const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const valueName = (kind: Kind) => (kind === "weight" ? "weight" : "price");

/** Which of the 13 digits belong to the product code, the value, both (a conflict), or neither. */
export function roleOfDigit(digit: number, product?: DigitRange, value?: DigitRange) {
  const inside = (range?: DigitRange) => !!range && digit >= range.first && digit <= range.last;
  if (inside(product) && inside(value)) return "conflict";
  if (inside(product)) return "product";
  if (inside(value)) return "value";
  if (digit < FIRST_DATA_DIGIT) return "prefix";
  return digit === CODE_DIGITS ? "check" : "free";
}
export const DIGITS = Array.from({ length: CODE_DIGITS }, (_, index) => index + 1);

/** The one thing wrong with a pair of ranges, in plain words, and the field that fixes it. */
export function layoutProblem(
  product: DigitRange,
  value: DigitRange,
  kind: Kind,
): { field: "productStart" | "valueStart"; message: string } | undefined {
  const name = valueName(kind);
  const overrun = (range: DigitRange, what: string) =>
    `${sentence(what)} ${digitsText(range)} run past digit ${LAST_DATA_DIGIT}. Digit ${CODE_DIGITS} is the check digit, so the data must stop at digit ${LAST_DATA_DIGIT}.`;
  if (product.last > LAST_DATA_DIGIT)
    return { field: "productStart", message: overrun(product, "product code") };
  if (value.last > LAST_DATA_DIGIT) return { field: "valueStart", message: overrun(value, name) };
  const shared = {
    first: Math.max(product.first, value.first),
    last: Math.min(product.last, value.last),
  };
  if (shared.first <= shared.last)
    return {
      field: "valueStart",
      message: `Product code (${digitsText(product)}) and ${name} (${digitsText(value)}) share ${digitsText(shared)}. Move one of them so they don't overlap.`,
    };
  return undefined;
}
