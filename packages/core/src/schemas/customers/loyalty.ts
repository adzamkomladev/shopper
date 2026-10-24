import * as v from "valibot";
import { money } from "@shopper/money";
import { customerId } from "./inputs";

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const whole = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const bps = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(10_000));

/** Loyalty per org: earn rate in bps of what is paid in money, what one point is worth, and how long points last. */
export const loyaltySettings = v.strictObject({
  enabled: v.boolean(),
  earnBps: bps,
  pointValue: v.pipe(whole, v.transform(money)),
  expiryDays: count,
  tierNoticeDays: count,
});
export type LoyaltySettings = v.InferOutput<typeof loyaltySettings>;

const tierName = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60));
const tierFields = {
  name: tierName,
  minSpend: v.pipe(count, v.transform(money)),
  earnBps: bps,
};
export const tierInput = v.strictObject(tierFields);
export const tierPatch = v.pipe(
  v.partial(v.strictObject(tierFields)),
  v.check((patch) => Object.keys(patch).length > 0, "Change at least one field"),
);

/** Points moved between two customers, with the reason kept in the audit. */
export const transferInput = v.strictObject({
  fromId: customerId,
  toId: customerId,
  points: whole,
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});
export const loyaltyHold = v.strictObject({
  id: customerId,
  orgId: customerId,
  sessionId: customerId,
  customerId,
  kind: v.literal("loyalty"),
  points: whole,
});
