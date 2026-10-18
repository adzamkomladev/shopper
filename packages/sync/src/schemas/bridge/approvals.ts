import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { approvalPermissions } from "@shopper/core/schemas";

const id = uuidV7Schema;

/** A manager's PIN entered on the register; the host verifies it, so the UI can never send a bare approver id. */
export const approval = v.strictObject({
  approverId: id,
  pin: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
});

export const approvalRequests = [
  v.strictObject({
    id,
    type: v.literal("approvers.list"),
    permission: v.picklist(approvalPermissions),
  }),
] as const;
export const approvalRequestTypes = approvalRequests.map((schema) => schema.entries.type.literal);

/** Who can approve and whether the register's list is too old to use; never PIN hashes. */
export const approvalReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("approvers"),
    approvers: v.array(v.strictObject({ userId: id, name: v.string() })),
    stale: v.boolean(),
  }),
] as const;
export type Approval = v.InferOutput<typeof approval>;
