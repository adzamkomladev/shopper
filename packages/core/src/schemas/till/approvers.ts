import * as v from "valibot";
import { tillId } from "./fields";

/** Grants that let a member approve an action on a till with their PIN. */
export const approvalPermissions = [
  "refund.approve",
  "sale.void",
  "sale.price_override",
  "shift.approve",
] as const;

/** `GET /sync/approvers`: who can approve with a PIN, and for which actions. */
export const approverList = v.strictObject({
  approvers: v.array(
    v.strictObject({
      userId: tillId,
      name: v.string(),
      pinHash: v.pipe(v.string(), v.minLength(1)),
      permissions: v.array(v.string()),
    }),
  ),
});
export type ApproverList = v.InferOutput<typeof approverList>;
