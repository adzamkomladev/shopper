import * as v from "valibot";
import { tillId } from "./fields";

/** Grants that let a member approve an action on a till with their PIN. */
export const approvalPermissions = [
  "refund.approve",
  "sale.void",
  "sale.price_override",
  "shift.approve",
  "staff.unlock",
] as const;

/** `GET /sync/approvers`: who can approve with a PIN, for which actions, and who may still sign in at the register. */
export const approverList = v.strictObject({
  approvers: v.array(
    v.strictObject({
      userId: tillId,
      name: v.string(),
      pinHash: v.pipe(v.string(), v.minLength(1)),
      permissions: v.array(v.string()),
    }),
  ),
  /** Absent from a server older than Day 21; the till then keeps its offline sign-ins as they are. */
  staff: v.optional(v.array(tillId)),
});
export type ApproverList = v.InferOutput<typeof approverList>;
