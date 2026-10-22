import * as v from "valibot";
import { money } from "@shopper/money";
import { customerId } from "./inputs";

const positive = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.transform(money));
const day = v.pipe(v.string(), v.isoDate());

/** A till's request to set credit aside; its id is the till's tender id. */
export const holdInput = v.strictObject({
  id: customerId,
  orgId: customerId,
  sessionId: customerId,
  customerId,
  kind: v.literal("credit"),
  amount: positive,
});
export type HoldInput = v.InferOutput<typeof holdInput>;
export const holdRelease = v.strictObject({ orgId: customerId, sessionId: customerId });

/** Money paid onto the account, keyed by the client's id so a retry replays. */
export const paymentInput = v.strictObject({
  id: customerId,
  amount: positive,
  method: v.picklist(["cash", "momo"]),
});
export const limitInput = v.strictObject({
  creditLimit: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
});
export const creditNoteInput = v.strictObject({
  amount: positive,
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});
/** Inclusive calendar days; Accra keeps UTC all year, so a day is a UTC day. */
export const statementQuery = v.pipe(
  v.object({ from: day, to: day }),
  v.check((q) => q.from <= q.to, "The statement must start before it ends"),
);
