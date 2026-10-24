import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createMaileroo, runAuthFlow } from "@shopper/auth";
import type { Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareFlow } from "./flow";
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
