import * as v from "valibot";
import { refundParams, runMomoRefund, type MomoDeps } from "@shopper/core/payments";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// shortcut: process-local waits are lost on restart; use Rivet Workflows when the box engine ships.
export function boxMomoRefund(deps: Omit<MomoDeps, "realtime">): WorkflowLauncher {
  const started = new Set<string>();
  return {
    send: (id, type, payload) =>
      memoryWorkflow(v.parse(workflowInstanceIdSchema, id)).send(id, type, payload),
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      v.parse(refundParams, params);
      if (started.has(id)) return;
      started.add(id);
      runMomoRefund(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId: id, error }),
      );
    },
  };
}
