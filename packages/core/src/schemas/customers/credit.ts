import * as v from "valibot";
import { money } from "@shopper/money";
import { tillId } from "../till/fields";
import { tillSession } from "../till/session";
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

const reference = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));
const referenceMessage = "A MoMo payment needs its reference";

/** `account.payment` v1: cash or MoMo taken at a till's drawer, keyed by its UUIDv7 so a retry replays. */
export const accountPaymentEvent = v.strictObject({
  v: v.literal(1),
  type: v.literal("account.payment"),
  payment: v.pipe(
    v.strictObject({
      orgId: tillId,
      /** The cashier session that took the money; the server judges it as it does a sale's. */
      sessionId: tillId,
      occurredAt: v.pipe(v.string(), v.isoTimestamp()),
      id: customerId,
      customerId,
      /** The register's shift the money went into; the server may not have it yet. */
      shiftId: tillId,
      method: v.picklist(["cash", "momo"]),
      amount: positive,
      reference: v.nullable(reference),
    }),
    v.check((p) => p.method !== "momo" || p.reference !== null, referenceMessage),
  ),
});
export type AccountPaymentEvent = v.InferOutput<typeof accountPaymentEvent>;

/** What the register asks to record at its drawer. */
export const recordAccountPaymentInput = v.pipe(
  v.strictObject({
    scope: v.strictObject({ orgId: tillId, deviceId: tillId, branchId: tillId }),
    session: tillSession,
    at: v.date(),
    customerId: tillId,
    method: v.picklist(["cash", "momo"]),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    reference: v.optional(v.nullable(reference), null),
  }),
  v.check((p) => p.method !== "momo" || p.reference !== null, referenceMessage),
);
