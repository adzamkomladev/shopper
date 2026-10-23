import * as v from "valibot";
import { fromDecimal, money, toDecimal } from "@shopper/money";
import { bpsToPercent, percentToBps } from "../../lib/rate";
import { amountField, daysField, percentField } from "./fields";

const count = v.pipe(v.number(), v.safeInteger());

/** What the API holds: the earn rate in basis points and the value of a point in money. */
export const loyaltySettingsView = v.object({
  enabled: v.boolean(),
  earnBps: count,
  pointValue: count,
  expiryDays: count,
  tierNoticeDays: count,
});
export type LoyaltySettingsView = v.InferOutput<typeof loyaltySettingsView>;

export const tierView = v.object({
  id: v.string(),
  name: v.string(),
  minSpend: count,
  earnBps: count,
  archivedAt: v.nullable(v.string()),
});
export type TierView = v.InferOutput<typeof tierView>;
export const tierList = v.object({ items: v.array(tierView) });

const earnRate = percentField(0.01, 100);

export const loyaltyFormSchema = v.object({
  enabled: v.boolean(),
  earnRate,
  pointValue: amountField(1, "Enter an amount above zero, like 0.05"),
  expiryDays: daysField(999, "Enter a whole number of days, 0 for never"),
  tierNoticeDays: daysField(999, "Enter a whole number of days, 0 for off"),
});
export type LoyaltyValues = v.InferInput<typeof loyaltyFormSchema>;

export const loyaltyValues = (settings: LoyaltySettingsView): LoyaltyValues => ({
  enabled: settings.enabled,
  earnRate: bpsToPercent(settings.earnBps),
  pointValue: toDecimal(money(settings.pointValue)),
  expiryDays: String(settings.expiryDays),
  tierNoticeDays: String(settings.tierNoticeDays),
});

export const toLoyaltyBody = (values: LoyaltyValues): LoyaltySettingsView => ({
  enabled: values.enabled,
  earnBps: percentToBps(values.earnRate),
  pointValue: fromDecimal(values.pointValue.trim()),
  expiryDays: Number(values.expiryDays),
  tierNoticeDays: Number(values.tierNoticeDays),
});

export const tierFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Give the tier a name"),
    v.maxLength(60, "Use 60 characters or fewer"),
  ),
  minSpend: amountField(0, "Enter an amount like 5000.00"),
  rate: earnRate,
});
export type TierValues = v.InferInput<typeof tierFormSchema>;

export const emptyTier: TierValues = { name: "", minSpend: "0.00", rate: "1.00" };
export const tierValues = (tier: TierView): TierValues => ({
  name: tier.name,
  minSpend: toDecimal(money(tier.minSpend)),
  rate: bpsToPercent(tier.earnBps),
});
export const toTierBody = (values: TierValues) => ({
  name: values.name.trim(),
  minSpend: fromDecimal(values.minSpend.trim()),
  earnBps: percentToBps(values.rate),
});
