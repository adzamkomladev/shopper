import * as v from "valibot";
import { money } from "@shopper/money";
import { uuidV7Schema } from "@shopper/ports";
import { customerId } from "./inputs";

const day = v.pipe(v.string(), v.isoDate());
const periodMessage = "The statement must start before it ends";
/** Below zero is a deposit, so unlike a payment the amount may be negative. */
const signed = v.pipe(v.number(), v.safeInteger(), v.transform(money));

/** Which statement to send, and over what. `pdf` rows exist for downloads; only these two are sent. */
export const statementSendInput = v.pipe(
  v.strictObject({ channel: v.picklist(["sms", "email"]), from: day, to: day }),
  v.check((q) => q.from <= q.to, periodMessage),
);
export const statementLinkInput = v.pipe(
  v.strictObject({ from: day, to: day }),
  v.check((q) => q.from <= q.to, periodMessage),
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
