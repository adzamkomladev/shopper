import * as v from "valibot";
import { money } from "@shopper/money";
import { uuidV7Schema } from "@shopper/ports";
import { customerId } from "./inputs";

const day = v.pipe(v.string(), v.isoDate());
const MAX_PERIOD_DAYS = 366;
/** A statement period: `from` not after `to`, at most a year of inclusive days, so a PDF and its query stay bounded. */
export const inPeriod = ({ from, to }: { from: string; to: string }) =>
  from <= to && (Date.parse(to) - Date.parse(from)) / 86_400_000 < MAX_PERIOD_DAYS;
export const periodMessage = `The statement must start before it ends and cover at most ${MAX_PERIOD_DAYS} days`;
/** Below zero is a deposit, so unlike a payment the amount may be negative. */
const signed = v.pipe(v.number(), v.safeInteger(), v.transform(money));

/** Which statement to send, and over what. `pdf` rows exist for downloads; only these two are sent. */
export const statementSendInput = v.pipe(
  v.strictObject({ channel: v.picklist(["sms", "email"]), from: day, to: day }),
  v.check((q) => inPeriod(q), periodMessage),
);
export const statementLinkInput = v.pipe(
  v.strictObject({ from: day, to: day }),
  v.check((q) => inPeriod(q), periodMessage),
);

/** What the queue carries for a statement to send; the consumer reads everything else from the row. */
export const statementMessage = v.looseObject({
  type: v.literal("statement.send"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ deliveryId: uuidV7Schema }),
});

/** The signed content of a customer's link; `exp` is epoch milliseconds. */
export const statementTokenPayload = v.strictObject({
  linkId: customerId,
  orgId: customerId,
  customerId,
  from: day,
  to: day,
  exp: v.pipe(v.number(), v.safeInteger()),
});
export type StatementTokenPayload = v.InferOutput<typeof statementTokenPayload>;

/** The statement as the page, the PDF and the messages see it: one customer, one period, no ledger ids. */
export const statementDocument = v.strictObject({
  v: v.literal(1),
  shop: v.strictObject({ name: v.string() }),
  customer: v.strictObject({ name: v.string(), phone: v.string() }),
  period: v.strictObject({ from: day, to: day }),
  opening: signed,
  entries: v.array(
    v.strictObject({
      kind: v.string(),
      method: v.nullable(v.string()),
      amount: signed,
      balance: signed,
      occurredAt: v.string(),
    }),
  ),
  closing: signed,
});
export type StatementDocument = v.InferOutput<typeof statementDocument>;

/** Statements on a schedule, per org: off, or monthly on a day (1-28, Accra) over the channels, above a minimum. */
export const statementSettings = v.pipe(
  v.strictObject({
    schedule: v.picklist(["off", "monthly"]),
    day: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(28)),
    channels: v.pipe(v.array(v.picklist(["sms", "email"])), v.maxLength(2)),
    minBalance: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
  }),
  v.check((s) => s.schedule === "off" || s.channels.length > 0, "Choose at least one channel"),
);

/** Start or wake the org's schedule; the actor is whom the scheduled statements are sent as. */
export const statementScheduleMessage = v.looseObject({
  type: v.literal("statement.schedule"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ actorId: v.pipe(v.string(), v.uuid()) }),
});

/** One customer's statements for one scheduled period. */
export const statementScheduledMessage = v.looseObject({
  type: v.literal("statement.scheduled"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({
    customerId,
    actorId: v.pipe(v.string(), v.uuid()),
    from: day,
    to: day,
    channels: v.array(v.picklist(["sms", "email"])),
  }),
});

/** What the statement-schedule workflow starts with; its instance id is the org id. */
export const statementFlowParams = v.strictObject({
  orgId: uuidV7Schema,
  actorId: v.pipe(v.string(), v.uuid()),
});
