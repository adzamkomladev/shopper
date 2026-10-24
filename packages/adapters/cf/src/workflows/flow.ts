import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowTimeoutError, type Json, type RetryPolicy, type Workflow } from "@shopper/ports";

/**
 * A Cloudflare Workflow run seen through the shared `Workflow` port, so the same flow function runs here and on the
 * box. Step outputs round-trip through JSON text; a wait that times out becomes the port's `WorkflowTimeoutError`.
 */
export function cloudflareFlow(
  event: WorkflowEvent<Json>,
  step: WorkflowStep,
): Pick<Workflow, "instanceId" | "step" | "waitFor"> {
  return {
    instanceId: event.instanceId,
    step: async <T extends Json>(name: string, policy: RetryPolicy, run: () => Promise<T>) =>
      JSON.parse(
        await step.do(
          name,
          {
            retries: {
              limit: policy.maxAttempts - 1,
              delay: policy.delayMs,
              backoff: policy.backoff,
            },
          },
          async () => JSON.stringify(await run()),
        ),
      ) as T,
    waitFor: async (name, type, timeoutMs) => {
      try {
        return (await step.waitForEvent<Record<string, string>>(name, { type, timeout: timeoutMs }))
          .payload;
      } catch (error) {
        // Workerd RPC can drop the timeout subclass name while preserving this engine message.
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          (error.name === "WorkflowTimeoutError" ||
            (error.name === "Error" &&
              "message" in error &&
              typeof error.message === "string" &&
              /^Execution timed out after \d+ms$/.test(error.message)))
        )
          throw new WorkflowTimeoutError(event.instanceId, name, type, timeoutMs);
        throw error;
      }
    },
  };
}
