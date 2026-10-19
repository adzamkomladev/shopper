import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { cashCounts, xReport, zReport } from "@shopper/core/schemas";
import { approval } from "./approvals";

const id = uuidV7Schema;
const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const reason = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200));
const timestamp = v.pipe(v.string(), v.isoTimestamp());

/** `shift.*`: the register's float, drops, no-sales, the X, the blind count, the close and report prints. */
export const shiftRequests = [
  /** The float as an amount or as counts, exactly one (checked on `bridgeRequest`). */
  v.strictObject({
    id,
    type: v.literal("shift.open"),
    float: v.optional(amount),
    counts: v.optional(cashCounts),
  }),
  v.strictObject({
    id,
    type: v.literal("shift.drop"),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  }),
  v.strictObject({ id, type: v.literal("shift.nosale"), reason }),
  v.strictObject({ id, type: v.literal("shift.report") }),
  v.strictObject({
    id,
    type: v.literal("shift.declare"),
    counts: cashCounts,
    card: amount,
    momo: amount,
  }),
  v.strictObject({ id, type: v.literal("shift.close"), approval: v.optional(approval) }),
  v.strictObject({ id, type: v.literal("shift.print"), shiftId: v.optional(id) }),
] as const;
export const shiftRequestTypes = shiftRequests.map((schema) => schema.entries.type.literal);

const closed = v.strictObject({ report: zReport, printed: v.boolean() });
const variance = v.strictObject({
  tender: v.picklist(["cash", "card", "momo"]),
  expected: v.number(),
  declared: v.number(),
  variance: v.number(),
});

export const shiftReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("shiftReport"),
    report: xReport,
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("shiftDeclared"),
    variances: v.array(variance),
    threshold: amount,
    approvalRequired: v.boolean(),
    /** Set when no manager was needed and the host closed the shift at once. */
    closed: v.nullable(closed),
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("shiftClosed"),
    ...closed.entries,
  }),
] as const;

/** The register's shift on the status; never its expected cash, so a cashier counts blind. */
export const shiftStatus = v.strictObject({
  current: v.nullable(
    v.strictObject({
      id,
      status: v.picklist(["open", "declared"]),
      openedAt: timestamp,
      openedBy: id,
      float: amount,
    }),
  ),
  last: v.nullable(
    v.strictObject({
      id,
      closedAt: timestamp,
      upload: v.picklist(["pending", "accepted", "rejected"]),
      blockedReason: v.nullable(v.string()),
    }),
  ),
});
export type ShiftStatus = v.InferOutput<typeof shiftStatus>;
