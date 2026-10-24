import * as v from "valibot";
import { dateSchema } from "@shopper/tax";

const bps = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10_000));
/** A dated rule as the editor sends it: the start date, each rate in basis points and where the rate comes from. */
export const taxRuleInput = v.strictObject({
  effectiveFrom: dateSchema,
  vatBps: bps,
  nhilBps: bps,
  getfundBps: bps,
  covidBps: bps,
  source: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});
