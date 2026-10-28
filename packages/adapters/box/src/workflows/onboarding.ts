import * as v from "valibot";
import { onboardingParams, runOnboarding } from "@shopper/core/onboarding";
import type { OnboardingFlowDeps } from "@shopper/core/onboarding";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// ponytail: the box opens no public signup, so it never starts one; this shell carries the shared function for
// conformance and the day 36 Rivet engine. Timers are lost on restart, as for every box workflow until then.
export function boxOnboardingFlows(deps: OnboardingFlowDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    async start(id, raw) {
      v.parse(workflowInstanceIdSchema, id);
      const params = v.parse(onboardingParams, raw);
      if (started.has(id)) return;
      started.add(id);
      runOnboarding(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "onboarding.workflow.failed", instanceId: id, error }),
      );
    },
    send: (id, type, payload) => {
      v.parse(workflowInstanceIdSchema, id);
      return memoryWorkflow(id).send(id, type, payload);
    },
  };
}
