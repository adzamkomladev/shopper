import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { approvalRequest, branch } from "@shopper/db-pg";
import { formatGHS } from "@shopper/money";
import type { Delivery } from "@shopper/ports";
import type { NotificationDeps } from "../notifications/types";
import { approvalMessage } from "./schemas/base";

/**
 * Texts the branch's alert phones that a register is waiting for a manager. A request already answered, or a
 * branch with no phones, sends nothing; with no SMS channel the message retries.
 */
export async function deliverApprovalRequest(deps: NotificationDeps, delivery: Delivery) {
  if (!deps.sms) return await delivery.retry();
  const { id } = v.parse(approvalMessage, delivery.message.payload);
  const [row] = await deps.db
    .select({ request: approvalRequest, branchName: branch.name, phones: branch.alertPhones })
    .from(approvalRequest)
    .innerJoin(
      branch,
      and(eq(branch.orgId, approvalRequest.orgId), eq(branch.id, approvalRequest.branchId)),
    )
    .where(and(eq(approvalRequest.orgId, delivery.message.orgId), eq(approvalRequest.id, id)));
  if (!row || row.request.status !== "pending" || !row.phones.length) return await delivery.ack();
  const what = row.request.kind === "refund" ? "A refund" : "A discount";
  await deps.sms.send(
    row.phones,
    `${what} of ${formatGHS(row.request.subject.amount)} at ${row.branchName} is waiting for a manager. ` +
      "Approve or decline it in the Shopper back office within 10 minutes.",
  );
  await delivery.ack();
}
