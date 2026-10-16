import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runMomoPayment } from "@shopper/core/payments";
import { createPaystack } from "@shopper/core/payments/paystack";
import { WorkflowTimeoutError, type Json, type RetryPolicy } from "@shopper/ports";
import type { StoreHub } from "../coordination";
import { cloudflareDatabase } from "../database";
import { cloudflareRealtime } from "../realtime";
interface MomoEnvironment {
  HYPERDRIVE: Hyperdrive;
  STORE_HUB: DurableObjectNamespace<StoreHub>;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
}
export class MomoPaymentWorkflow extends WorkflowEntrypoint<MomoEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runMomoPayment(
      {
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
            return (
              await step.waitForEvent<{ type: "otp" | "settled"; otp?: string }>(name, {
                type,
                timeout: timeoutMs,
              })
            ).payload;
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
      },
      {
        withDatabase: async (run) => {
          const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
          try {
            return await run(connection.db);
          } finally {
            await connection.close();
          }
        },
        realtime: cloudflareRealtime(this.env.STORE_HUB),
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
