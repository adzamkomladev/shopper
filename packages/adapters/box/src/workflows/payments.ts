import * as v from "valibot";
import { momoParams, runMomoPayment, type MomoDeps } from "@shopper/core/payments";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// shortcut: process-local waits are lost on restart; use Rivet Workflows when the box engine ships.
export function boxMomoPayment(deps: MomoDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    send: (id, type, payload) =>
      memoryWorkflow(v.parse(workflowInstanceIdSchema, id)).send(id, type, payload),
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      v.parse(momoParams, params);
      if (started.has(id)) return;
      started.add(id);
      runMomoPayment(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId: id, error }),
      );
    },
  };
}
