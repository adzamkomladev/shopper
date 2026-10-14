import * as v from "valibot";
import { authFlowParamsSchema, runAuthFlow, type AuthFlowDeps } from "@shopper/auth";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// shortcut: waiting flows are lost on box restart, Rivet recovery is scheduled for day 36; DB expiry remains authoritative.
export function boxAuthFlows(deps: AuthFlowDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    async start(id, raw) {
      v.parse(workflowInstanceIdSchema, id);
      const params = v.parse(authFlowParamsSchema, raw);
      if (started.has(id)) return;
      started.add(id);
      runAuthFlow(memoryWorkflow(id), deps, params).catch(() =>
        console.error({ event: "auth.workflow.failed", instanceId: id }),
      );
    },
    send: (id, type, payload) => {
      v.parse(workflowInstanceIdSchema, id);
      return memoryWorkflow(id).send(id, type, payload);
    },
  };
}
