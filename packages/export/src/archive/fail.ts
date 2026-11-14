import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { exportJob } from "@shopper/db-pg";

/** Marks an archive that could not be made, with a reason an owner can read. */
export const failArchiveExport = defineCommand({
  name: "export.archive.fail",
  async run(tx, _ctx, input: { jobId: string; reason: string }) {
    const reason = input.reason.slice(0, 500);
    await tx
      .update(exportJob)
      .set({ status: "failed", error: reason, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(exportJob.id, input.jobId));
    return { jobId: input.jobId, reason };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "export_job", entityId: output.jobId }),
});
