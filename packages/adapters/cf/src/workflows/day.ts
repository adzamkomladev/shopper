import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runStoreDay } from "@shopper/core/reports";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareLauncher } from "../launcher";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

interface StoreDayEnvironment {
  HYPERDRIVE: Hyperdrive;
  STORE_DAY: Parameters<typeof cloudflareLauncher>[0];
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
}

/** Cloudflare shell for one store's trading day (instance id = the store-day key); it starts the next day itself. */
export class StoreDayWorkflow extends WorkflowEntrypoint<StoreDayEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runStoreDay(
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
        storeDays: cloudflareLauncher(this.env.STORE_DAY),
      },
      event.payload,
    );
  }
}
