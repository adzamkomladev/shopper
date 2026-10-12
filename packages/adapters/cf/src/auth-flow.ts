import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createMaileroo, runAuthFlow } from "@shopper/auth";
import { WorkflowTimeoutError, type Json, type RetryPolicy } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
interface AuthFlowEnvironment {
  HYPERDRIVE: Hyperdrive;
  SHOPPER_LINK_SECRET: string;
  SHOPPER_AUTH_URL: string;
  MAILEROO_API_KEY?: string;
  MAILEROO_FROM?: string;
  MAILEROO_ENDPOINT?: string;
}
export class AuthWorkflow extends WorkflowEntrypoint<AuthFlowEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runAuthFlow(
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
            return (await step.waitForEvent<{ action: string }>(name, { type, timeout: timeoutMs }))
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
        linkSecret: this.env.SHOPPER_LINK_SECRET,
        baseURL: this.env.SHOPPER_AUTH_URL,
        mail:
          this.env.MAILEROO_API_KEY && this.env.MAILEROO_FROM
            ? createMaileroo({
                apiKey: this.env.MAILEROO_API_KEY,
                from: this.env.MAILEROO_FROM,
                endpoint: this.env.MAILEROO_ENDPOINT,
              })
            : undefined,
      },
      event.payload,
    );
  }
}
