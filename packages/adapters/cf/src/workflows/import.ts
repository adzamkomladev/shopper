import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runArchiveImport } from "@shopper/export";
import type { Json } from "@shopper/ports";
import { cloudflareDatabase } from "../database";
import { cloudflareBlobs } from "../storage";
import { cloudflareFlow } from "./flow";

interface ArchiveImportEnvironment {
  HYPERDRIVE: Hyperdrive;
  BLOBS: R2Bucket;
  RECEIPTS?: R2Bucket;
  SHOPPER_AUTH_URL?: string;
  SHOPPER_AUTH_SECRET?: string;
}

/** Cloudflare shell for a box moving in: the archive imported as its org (instance id = the import key). */
export class ArchiveImportWorkflow extends WorkflowEntrypoint<ArchiveImportEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    const { blobs } = await cloudflareBlobs(this.env.BLOBS, {
      receipts: this.env.RECEIPTS,
      baseUrl: this.env.SHOPPER_AUTH_URL ?? "https://shopper.invalid",
      secret: new TextEncoder().encode(this.env.SHOPPER_AUTH_SECRET ?? ""),
    });
    await runArchiveImport(
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
