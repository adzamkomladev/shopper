import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { approvalRequest, branch, workflowRun, type ShopperTransaction } from "@shopper/db-pg";
import { allocateStoreSequence } from "../sequence";
import { hasGrant } from "../sales/authority";
import { ManagementError } from "../management";
import type { approvalDecision, approvalInput } from "./schemas/base";

/** How long a manager has to answer before the request expires. */
export const APPROVAL_MS = 10 * 60_000;
const permissionOf = { refund: "refund.approve", discount: "sale.discount" } as const;

/** A register's request: stored with its 10-minute expiry and the workflow's run row, and texted to the branch. */
export const requestApproval = defineCommand({
  name: "approval.requested",
  async run(
    tx,
    context: CommandContext,
    input: v.InferOutput<typeof approvalInput> & { deviceId: string; branchId: string; at: Date },
  ) {
    const [row] = await tx
      .insert(approvalRequest)
      .values({
        id: v7(),
        orgId: context.orgId,
        branchId: input.branchId,
        deviceId: input.deviceId,
        requestedBy: context.actorId!,
        kind: input.kind,
        subject: {
          saleId: input.saleId,
          receiptNumber: input.receiptNumber,
          amount: input.amount,
          reason: input.reason,
        },
        expiresAt: new Date(input.at.valueOf() + APPROVAL_MS),
      })
      .returning();
    await tx.insert(workflowRun).values({
      orgId: context.orgId,
      instanceId: row!.id,
      businessKey: row!.id,
      type: "approval",
      currentStep: "requested",
      status: "waiting",
    });
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: context.orgId,
      v: 1,
      sequence: "0",
      type: "approval.requested",
      payload: { id: row!.id },
    });
    return approvalView(row!);
  },
  audit: (_input, output) => ({ id: output.id, kind: output.kind, amount: output.subject.amount }),
  details: (_input, output) => ({ entity: "approval", entityId: output.id }),
});

/**
 * A manager's answer. They must hold the permission the request needs, at its branch, and not be the cashier who
 * asked; an answered or expired request cannot be answered again.
 */
export const decideApproval = defineCommand({
  name: "approval.decided",
  async run(
    tx,
    context: CommandContext,
    input: v.InferOutput<typeof approvalDecision> & { id: string; at: Date },
  ) {
    const row = await lockApproval(tx, context.orgId, input.id);
    if (row.requestedBy === context.actorId)
      throw new ManagementError("You cannot approve your own request", 409);
    if (row.status !== "pending" || row.expiresAt <= input.at)
      throw new ManagementError("This request has already been answered or has expired", 409);
    if (
      !(await hasGrant(
        tx,
        context.orgId,
        context.actorId!,
        permissionOf[row.kind],
        input.at,
        row.branchId,
      ))
    )
      throw new ManagementError("You cannot approve this at that branch", 404);
    const [saved] = await tx
      .update(approvalRequest)
      .set({
        status: input.decision,
        decidedBy: context.actorId!,
        decidedAt: input.at,
        declineReason: input.decision === "declined" ? (input.reason ?? null) : null,
      })
      .where(and(eq(approvalRequest.orgId, context.orgId), eq(approvalRequest.id, input.id)))
      .returning();
    if (input.decision === "approved") context.approverId = context.actorId;
    return approvalView(saved!);
  },
  audit: (input, output) => ({ id: output.id, decision: input.decision }),
  details: (_input, output) => ({ entity: "approval", entityId: output.id }),
});

/** The workflow's timeout: a request nobody answered expires (an answered one is left as it is). */
export const expireApproval = defineCommand({
  name: "approval.expired",
  async run(tx, context: CommandContext, input: { id: string }) {
    const row = await lockApproval(tx, context.orgId, input.id);
    if (row.status !== "pending") return approvalView(row);
    const [saved] = await tx
      .update(approvalRequest)
      .set({ status: "expired" })
      .where(and(eq(approvalRequest.orgId, context.orgId), eq(approvalRequest.id, input.id)))
      .returning();
    return approvalView(saved!);
  },
  audit: (_input, output) => ({ id: output.id, status: output.status }),
});

/** The till's `approval.decided` push for the request's store, store-sequenced like every till envelope. */
export const pushApproval = defineCommand({
  name: "approval.pushed",
  async run(tx, context: CommandContext, input: { id: string }) {
    const view = approvalView(await lockApproval(tx, context.orgId, input.id));
    const [store] = await tx
      .select({ id: branch.storeId })
      .from(branch)
      .where(and(eq(branch.orgId, context.orgId), eq(branch.id, view.branchId)));
    return {
      storeId: store!.id,
      envelope: {
        id: v7(),
        orgId: context.orgId,
        v: 1,
        sequence: (await allocateStoreSequence(tx, context.orgId, store!.id)).toString(),
        type: "approval.decided",
        payload: view,
      },
    };
  },
  audit: (_input, output) => ({
    id: output.envelope.payload.id,
    status: output.envelope.payload.status,
  }),
});

export function approvalView(row: typeof approvalRequest.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    branchId: row.branchId,
    deviceId: row.deviceId,
    requestedBy: row.requestedBy,
    subject: row.subject,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    declineReason: row.declineReason,
    expiresAt: row.expiresAt.toISOString(),
    consumed: row.consumedAt !== null,
  };
}

async function lockApproval(tx: ShopperTransaction, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(approvalRequest)
    .where(and(eq(approvalRequest.orgId, orgId), eq(approvalRequest.id, id)))
    .for("update");
  if (!row) throw new ManagementError("Approval not found");
  return row;
}
