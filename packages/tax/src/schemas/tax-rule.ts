import * as v from "valibot";

const rate = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000));
export const taxClassSchema = v.picklist(["standard", "zero-rated", "exempt"]);
export type TaxClass = v.InferOutput<typeof taxClassSchema>;
export const dateSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}$/),
  v.check((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !value.startsWith("0000-") &&
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Expected a calendar date"),
);
export const taxRuleSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  effectiveFrom: dateSchema,
  vatBps: rate,
  nhilBps: rate,
  getfundBps: rate,
  covidBps: rate,
});
export type TaxRule = v.InferOutput<typeof taxRuleSchema>;
