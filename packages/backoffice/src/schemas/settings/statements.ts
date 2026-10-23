import * as v from "valibot";
import { fromDecimal, money, toDecimal } from "@shopper/money";
import { amountField } from "./fields";

const CHANNELS = ["sms", "email"] as const;

/** What the API holds: when statements go out, over which channels, and the least balance that gets one. */
export const statementSettingsView = v.object({
  schedule: v.picklist(["off", "monthly"]),
  day: v.pipe(v.number(), v.safeInteger()),
  channels: v.array(v.picklist(CHANNELS)),
  minBalance: v.pipe(v.number(), v.safeInteger()),
});
export type StatementSettingsView = v.InferOutput<typeof statementSettingsView>;

export const statementsFormSchema = v.pipe(
  v.object({
    schedule: v.picklist(["off", "monthly"]),
    day: v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^\d{1,2}$/, "Enter a day from 1 to 28"),
      v.check((text) => Number(text) >= 1 && Number(text) <= 28, "Enter a day from 1 to 28"),
    ),
    sms: v.boolean(),
    email: v.boolean(),
    minBalance: amountField(0, "Enter an amount like 50.00, or 0 for everyone who owes"),
  }),
  v.forward(
    v.partialCheck(
      [["schedule"], ["sms"], ["email"]],
      (values) => values.schedule === "off" || values.sms || values.email,
      "Choose at least one channel",
    ),
    ["sms"],
  ),
);
export type StatementsValues = v.InferInput<typeof statementsFormSchema>;

export const statementsValues = (settings: StatementSettingsView): StatementsValues => ({
  schedule: settings.schedule,
  day: String(settings.day),
  sms: settings.channels.includes("sms"),
  email: settings.channels.includes("email"),
  minBalance: toDecimal(money(settings.minBalance)),
});

export const toStatementsBody = (values: StatementsValues): StatementSettingsView => ({
  schedule: values.schedule,
  day: Number(values.day),
  channels: CHANNELS.filter((channel) => values[channel]),
  minBalance: fromDecimal(values.minBalance.trim()),
});
