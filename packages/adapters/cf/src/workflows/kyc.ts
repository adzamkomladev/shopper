import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { runKyc } from "@shopper/auth/kyc";
import { createArkesel } from "@shopper/core/sms/arkesel";
import type { Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareFlow } from "./flow";

interface KycEnvironment {
  HYPERDRIVE: Hyperdrive;
  SHOPPER_LINK_SECRET: string;
  ARKESEL_API_KEY: string;
  ARKESEL_SENDER: string;
  ARKESEL_BASE_URL?: string;
}

export class KycWorkflow extends WorkflowEntrypoint<KycEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runKyc(
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
        sms: createArkesel({
          apiKey: this.env.ARKESEL_API_KEY,
          sender: this.env.ARKESEL_SENDER,
          baseUrl: this.env.ARKESEL_BASE_URL || undefined,
        }),
        linkSecret: this.env.SHOPPER_LINK_SECRET,
      },
      event.payload,
    );
  }
}
