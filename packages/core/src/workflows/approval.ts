import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { approvalRequest } from "@shopper/db-pg";
import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";
import { expireApproval, pushApproval } from "../approvals/commands";
import { approvalParams } from "../approvals/schemas/base";
import type { ApprovalDeps } from "../approvals/types";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;

/**
 * One remote approval (instance id = its id): waits for the manager's `manager_approval` until the request expires,
 * expires it if nobody answered, then pushes the outcome to the register's store. The decision itself is recorded by
 * the back office in PostgreSQL; the event only ends the wait.
 */
export async function runApproval(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: ApprovalDeps,
  raw: unknown,
) {
  const params = v.parse(approvalParams, raw);
  if (params.id !== flow.instanceId) throw new Error("Approval business key mismatch");
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  const checkpoint = (step: string) => ({
    instanceId: params.id,
    businessKey: params.id,
    type: "approval",
    step,
    status: "completed" as const,
  });
  const [row] = await deps.withDatabase((db) =>
    db
      .select({ expiresAt: approvalRequest.expiresAt })
      .from(approvalRequest)
      .where(and(eq(approvalRequest.orgId, params.orgId), eq(approvalRequest.id, params.id))),
  );
  if (!row) throw new Error("Approval not found");
  const wait = deps.timeoutMs ?? Math.max(0, row.expiresAt.valueOf() - (deps.now ?? Date.now)());
  const step = await flow
    .waitFor("decision", "manager_approval", wait)
    .then(() => "decided")
    .catch((error: unknown) => {
      if (error instanceof WorkflowTimeoutError) return "expired";
      throw error;
    });
  if (step === "expired")
    await flow.step("expired", policy, () =>
      deps.withDatabase((db) =>
        expireApproval(
          db,
          context,
          { id: params.id },
          { ...checkpoint("expired"), status: "waiting" },
        ),
      ),
    );
  await flow.step("pushed", policy, async () => {
    const pushed = await deps.withDatabase((db) =>
      pushApproval(db, context, { id: params.id }, checkpoint("pushed")),
    );
    await deps.realtime.publish(params.orgId, pushed.storeId, pushed.envelope);
    return pushed.envelope.payload;
  });
}
