import * as v from "valibot";

export const approvalRow = v.object({
  id: v.string(),
  kind: v.picklist(["refund", "discount"]),
  branchId: v.string(),
  deviceId: v.string(),
  requestedBy: v.string(),
  requesterName: v.optional(v.nullable(v.string())),
  subject: v.object({
    saleId: v.optional(v.string()),
    receiptNumber: v.optional(v.string()),
    amount: v.number(),
    reason: v.string(),
  }),
  status: v.picklist(["pending", "approved", "declined", "expired"]),
  decidedBy: v.nullable(v.string()),
  decidedAt: v.nullable(v.string()),
  declineReason: v.nullable(v.string()),
  expiresAt: v.string(),
  consumed: v.boolean(),
});
export type ApprovalRow = v.InferOutput<typeof approvalRow>;

export const approvalList = v.object({ approvals: v.array(approvalRow) });

export type ApprovalDecision = { decision: "approved" } | { decision: "declined"; reason?: string };
