import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { receiptDocument, refundSnapshot } from "@shopper/core/schemas";
import { approval } from "./approvals";

const id = uuidV7Schema;
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const receipt = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64));
const sale = { saleId: v.optional(id), receipt: v.optional(receipt) };

/** `refund.*` name a sale on this register by `saleId`, or any sale of the store by its `receipt` number. */
export const refundRequests = [
  v.strictObject({ id, type: v.literal("sales.lookup"), receipt }),
  v.strictObject({ id, type: v.literal("refund.preview"), ...sale }),
  v.strictObject({
    id,
    type: v.literal("refund.record"),
    ...sale,
    lines: v.pipe(
      v.array(v.strictObject({ lineId: id, quantityThousandths: v.number() })),
      v.minLength(1),
    ),
    reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
    tender: v.variant("kind", [
      v.strictObject({ kind: v.literal("cash") }),
      v.strictObject({
        kind: v.picklist(["card", "momo"]),
        reference: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
      }),
    ]),
    approval: v.optional(approval),
  }),
] as const;
export const refundRequestTypes = refundRequests.map((schema) => schema.entries.type.literal);

/** The refund requests name exactly one of `saleId` and `receipt`. */
export const namesOneSale = (request: object & { type: string }) =>
  !request.type.startsWith("refund.") ||
  ("saleId" in request && request.saleId !== undefined) !==
    ("receipt" in request && request.receipt !== undefined);

export const eligibilityView = v.strictObject({
  origin: v.picklist(["local", "server"]),
  windowEndsAt: v.pipe(v.string(), v.isoTimestamp()),
  withinWindow: v.boolean(),
  approvalRequired: v.boolean(),
  refundable: v.boolean(),
  lines: v.array(
    v.strictObject({
      lineId: id,
      productId: id,
      name: v.string(),
      soldThousandths: count,
      refundedThousandths: count,
      remainingThousandths: count,
      status: v.picklist(["eligible", "final", "returned"]),
    }),
  ),
});

export const refundSummary = v.strictObject({
  id,
  occurredAt: v.pipe(v.string(), v.isoTimestamp()),
  reason: v.string(),
  tender: refundSnapshot.entries.tender,
  total: v.number(),
  approverId: v.nullable(id),
  lines: v.array(
    v.strictObject({ lineId: id, name: v.string(), quantityThousandths: count, gross: v.number() }),
  ),
  accepted: v.boolean(),
  blockedCode: v.nullable(v.string()),
  blockedReason: v.nullable(v.string()),
});

export const refundReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("refundPreview"),
    eligibility: eligibilityView,
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("refund"),
    origin: v.picklist(["local", "server"]),
    refund: refundSnapshot,
    receipt: receiptDocument,
  }),
] as const;

export type EligibilityView = v.InferOutput<typeof eligibilityView>;
