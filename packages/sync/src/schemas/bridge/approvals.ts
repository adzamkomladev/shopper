import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { approvalPermissions } from "@shopper/core/schemas";

const id = uuidV7Schema;

/** A manager's PIN entered on the register; the host verifies it, so the UI can never send a bare approver id. */
export const pinApproval = v.strictObject({
  approverId: id,
  pin: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
});
/** A manager's answer from the back office; the host checks it with the server before it is used. */
export const remoteApproval = v.strictObject({ approvalId: id });
export const approval = v.union([pinApproval, remoteApproval]);

export const approvalRequests = [
  v.strictObject({
    id,
    type: v.literal("approvers.list"),
    permission: v.picklist(approvalPermissions),
  }),
  /** Asks the branch's managers to approve a refund of a sale, for an exact amount, from the back office. */
  v.strictObject({
    id,
    type: v.literal("approval.remote.request"),
    kind: v.literal("refund"),
    /** The sale's id, the same on the register and the server. */
    saleId: id,
    receiptNumber: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64))),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  }),
  v.strictObject({ id, type: v.literal("approval.remote.status"), approvalId: id }),
] as const;
export const approvalRequestTypes = approvalRequests.map((schema) => schema.entries.type.literal);

/** Where a remote request stands; the register uses it only once it is approved. */
export const remoteApprovalView = v.strictObject({
  id,
  status: v.picklist(["pending", "approved", "declined", "expired"]),
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  declineReason: v.nullable(v.string()),
});

/** Who can approve and whether the register's list is too old to use; never PIN hashes. */
export const approvalReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("approvers"),
    approvers: v.array(v.strictObject({ userId: id, name: v.string() })),
    stale: v.boolean(),
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("remoteApproval"),
    approval: remoteApprovalView,
  }),
] as const;
export type Approval = v.InferOutput<typeof approval>;
export type RemoteApprovalView = v.InferOutput<typeof remoteApprovalView>;
