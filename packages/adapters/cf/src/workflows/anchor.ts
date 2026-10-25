import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runAuditAnchor } from "@shopper/core/audit";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

interface AuditAnchorEnvironment {
  HYPERDRIVE: Hyperdrive;
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
}

/** Cloudflare shell for the daily audit anchor (instance id = the org-day key). */
export class AuditAnchorWorkflow extends WorkflowEntrypoint<AuditAnchorEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runAuditAnchor(
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
