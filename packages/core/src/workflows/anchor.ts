import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import { auditAnchorId, publishAnchors } from "../audit/anchor";
import { auditAnchorParams } from "../schemas/audit/anchor";
import type { AuditAnchorDeps } from "./types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;

/** One org's daily anchor: a single checkpointed step, so a restart or a second start publishes nothing more. */
export async function runAuditAnchor(
  flow: Pick<Workflow, "instanceId" | "step">,
  deps: AuditAnchorDeps,
  raw: unknown,
) {
  const params = v.parse(auditAnchorParams, raw);
  if (flow.instanceId !== auditAnchorId(params.orgId, params.day))
    throw new Error("Audit anchor instance must be its org-day key");
  await flow.step("anchor", policy, () =>
    deps.withDatabase((db) =>
      publishAnchors(
        db,
        { orgId: params.orgId, appVersion: deps.appVersion, queue: deps.queue },
        { day: params.day },
        {
          instanceId: flow.instanceId,
          businessKey: flow.instanceId,
          type: "audit-anchor",
          step: "anchor",
          status: "completed",
        },
      ),
    ),
  );
}
