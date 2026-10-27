import * as v from "valibot";
import { money } from "@shopper/money";
import { uuidV7Schema } from "@shopper/ports";

/** What a register asks a manager to approve: a refund of a sale, or a discount, for an exact amount. */
export const approvalInput = v.strictObject({
  kind: v.picklist(["refund", "discount"]),
  saleId: v.optional(uuidV7Schema),
  receiptNumber: v.optional(v.pipe(v.string(), v.maxLength(40))),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.transform(money)),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});

export const approvalDecision = v.variant("decision", [
  v.strictObject({ decision: v.literal("approved") }),
  v.strictObject({
    decision: v.literal("declined"),
    reason: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500))),
  }),
]);

export const approvalListQuery = v.object({
  status: v.optional(v.picklist(["pending", "approved", "declined", "expired"]), "pending"),
});

/** The approval workflow's params; its instance id is the approval's id. */
export const approvalParams = v.strictObject({ orgId: uuidV7Schema, id: uuidV7Schema });

/** The `approval.requested` queue message: the approval to text the branch's managers about. */
export const approvalMessage = v.object({ id: uuidV7Schema });

/** The workflow's `manager_approval` event: the decision recorded in PostgreSQL wakes it. */
export const approvalEvent = v.object({ status: v.picklist(["approved", "declined"]) });
