import * as v from "valibot";
import { percentField } from "../settings/fields";
import { bpsToPercent, percentToBps } from "../../lib/rate";

const bps = v.pipe(v.number(), v.safeInteger());
export const taxRuleView = v.object({
  id: v.string(),
  effectiveFrom: v.string(),
  vatBps: bps,
  nhilBps: bps,
  getfundBps: bps,
  covidBps: bps,
  source: v.string(),
});
export type TaxRuleView = v.InferOutput<typeof taxRuleView>;
export const taxRulesView = v.object({ rules: v.array(taxRuleView) });
/** DELETE answers 204 with no body. */
export const removedRule = v.null();
/** A rule's place in time on a given day: the latest started one is in force. */
export type RuleRow = TaxRuleView & { status: "scheduled" | "current" | "past" };

/** A scheduled rule as typed: the start date and each rate as a percentage. */
export const ruleFormSchema = v.object({
  effectiveFrom: v.pipe(
    v.string(),
    v.regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the rates start"),
  ),
  vat: percentField(0, 100),
  nhil: percentField(0, 100),
  getfund: percentField(0, 100),
  covid: percentField(0, 100),
  source: v.pipe(v.string(), v.trim(), v.minLength(1, "Say where the rates come from")),
});
export type RuleValues = v.InferInput<typeof ruleFormSchema>;

export const ruleValues = (rule?: TaxRuleView): RuleValues => ({
  effectiveFrom: rule?.effectiveFrom ?? "",
  vat: bpsToPercent(rule?.vatBps ?? 1_500),
  nhil: bpsToPercent(rule?.nhilBps ?? 250),
  getfund: bpsToPercent(rule?.getfundBps ?? 250),
  covid: bpsToPercent(rule?.covidBps ?? 0),
  source: rule?.source ?? "",
});

export const toRuleBody = (values: RuleValues) => ({
  effectiveFrom: values.effectiveFrom,
  vatBps: percentToBps(values.vat),
  nhilBps: percentToBps(values.nhil),
  getfundBps: percentToBps(values.getfund),
  covidBps: percentToBps(values.covid),
  source: values.source.trim(),
});
