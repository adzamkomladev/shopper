import * as v from "valibot";
import { bpsToPercent, percentToBps } from "../../lib/rate";
import { daysField, percentField } from "./fields";

const count = v.pipe(v.number(), v.safeInteger());

export const creditSettingsView = v.object({ termsDays: count, interestBps: count });
export type CreditSettingsView = v.InferOutput<typeof creditSettingsView>;

export const creditFormSchema = v.object({
  termsDays: daysField(365, "Enter 0 to 365 days"),
  interest: percentField(0, 100),
});
export type CreditValues = v.InferInput<typeof creditFormSchema>;

export const creditValues = (settings: CreditSettingsView): CreditValues => ({
  termsDays: String(settings.termsDays),
  interest: bpsToPercent(settings.interestBps),
});

export const toCreditBody = (values: CreditValues): CreditSettingsView => ({
  termsDays: Number(values.termsDays),
  interestBps: percentToBps(values.interest),
});
