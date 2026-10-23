import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runAccount } from "@shopper/core/customers";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

interface AccountEnvironment {
  HYPERDRIVE: Hyperdrive;
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
}

/** Cloudflare shell for the shared customer-account workflow (instance id = customer id). */
export class AccountWorkflow extends WorkflowEntrypoint<AccountEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runAccount(
      cloudflareFlow(event, step),
      {
        withDatabase: async (run) => {
          const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
          try {
            return await run(connection.db);
          } finally {
            await connection.close();
          }
        },
        appVersion: buildInfo.version,
        queue: this.env.NOTIFICATIONS
          ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
          : undefined,
      },
      event.payload,
    );
  }
}
