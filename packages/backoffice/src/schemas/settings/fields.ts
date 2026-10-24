import * as v from "valibot";
import { fromDecimal } from "@shopper/money";
import { percentToBps, RATE_PATTERN } from "../../lib/rate";

export const RATE_SHAPE = "Enter a rate like 2.5";

/** A percentage typed as a decimal, from `min` to `max` percent. */
export const percentField = (min: number, max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.regex(RATE_PATTERN, RATE_SHAPE),
    v.check((text) => {
      const bps = percentToBps(text);
      return bps >= min * 100 && bps <= max * 100;
    }, `Enter a rate from ${min} to ${max}`),
  );

const parsed = (text: string) => {
  try {
    return fromDecimal(text);
  } catch {
    return undefined;
  }
};

/** A GH₵ amount typed as a decimal; `above` is the least it may be, in money units. */
export const amountField = (above: 0 | 1, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.check((text) => {
      const amount = parsed(text);
      return amount !== undefined && amount >= above;
    }, message),
  );

/** A whole number of days from 0 to `max`. */
export const daysField = (max: number, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,3}$/, message),
    v.check((text) => Number(text) <= max, message),
  );
