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
/** A rule the editor may save: it starts after `today` (an Accra date), so no sale already made falls under it. */
export const scheduledRule = (today: string) =>
  v.pipe(
    taxRuleInput,
    v.check((rule) => rule.effectiveFrom > today, "A rule must start after today"),
  );
