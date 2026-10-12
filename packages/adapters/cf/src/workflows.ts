import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runPriceChange } from "@shopper/core/catalogue";
import type { Json, RetryPolicy } from "@shopper/ports";
import type { StoreHub } from "./coordination";
import { cloudflareDatabase } from "./database";
import { cloudflareRealtime } from "./realtime";

interface WorkflowEnv {
  HYPERDRIVE: Hyperdrive;
  STORE_HUB: DurableObjectNamespace<StoreHub>;
}
/** Cloudflare shell for the shared scheduled price change. */
export class PriceChangeWorkflow extends WorkflowEntrypoint<WorkflowEnv, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runPriceChange(
      {
        instanceId: event.instanceId,
        // Steps carry Json; a JSON string keeps Cloudflare's Serializable type check shallow.
        step: async <T extends Json>(name: string, policy: RetryPolicy, run: () => Promise<T>) =>
          JSON.parse(
            await step.do(name, retries(policy), async () => JSON.stringify(await run())),
          ) as T,
        // Cloudflare rejects a sleep into the past; the box engine returns at once, so match it.
        sleepUntil: async (name, instant) => {
          if (instant.getTime() > Date.now()) await step.sleepUntil(name, instant);
        },
      },
      {
        // A fresh Hyperdrive connection per step; nothing is held across a sleep.
        withDatabase: async (run) => {
          const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
          try {
            return await run(connection.db);
          } finally {
            await connection.close();
          }
        },
        realtime: cloudflareRealtime(this.env.STORE_HUB),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
const retries = (policy: RetryPolicy) => ({
  retries: { limit: policy.maxAttempts - 1, delay: policy.delayMs, backoff: policy.backoff },
});

export { AuthWorkflow } from "./auth-flow";
