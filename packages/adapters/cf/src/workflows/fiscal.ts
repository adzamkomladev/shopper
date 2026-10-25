import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runFiscalArchive } from "@shopper/core/fiscal";
import type { Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareBlobs } from "../storage";
import { cloudflareFlow } from "./flow";

interface FiscalArchiveEnvironment {
  HYPERDRIVE: Hyperdrive;
  BLOBS: R2Bucket;
  SHOPPER_AUTH_URL?: string;
  SHOPPER_AUTH_SECRET?: string;
}

/** Cloudflare shell for the hourly fiscal archive (instance id = the store-hour key). */
export class FiscalArchiveWorkflow extends WorkflowEntrypoint<FiscalArchiveEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    const { blobs } = await cloudflareBlobs(this.env.BLOBS, {
      baseUrl: this.env.SHOPPER_AUTH_URL ?? "https://shopper.invalid",
      secret: new TextEncoder().encode(this.env.SHOPPER_AUTH_SECRET ?? ""),
    });
    await runFiscalArchive(
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
        blobs,
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
