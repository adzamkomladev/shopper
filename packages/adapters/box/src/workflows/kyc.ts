import * as v from "valibot";
import { kycFlowParams, runKyc, type KycFlowDeps } from "@shopper/auth/kyc";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// ponytail: timers are lost when the box restarts; Rivet Workflows arrive on day 36. Until then the deadlines in
// PostgreSQL decide: a late answer is refused and a lapsed case is expired by the command that meets it.
export function boxKycFlows(deps: KycFlowDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    async start(id, raw) {
      v.parse(workflowInstanceIdSchema, id);
      const params = v.parse(kycFlowParams, raw);
      if (started.has(id)) return;
      started.add(id);
      runKyc(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "kyc.workflow.failed", instanceId: id, error }),
      );
    },
    send: (id, type, payload) => {
      v.parse(workflowInstanceIdSchema, id);
      return memoryWorkflow(id).send(id, type, payload);
    },
  };
}
