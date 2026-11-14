import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { exportJob } from "@shopper/db-pg";
import { ExportError } from "./error";

/** Records that an owner asked for a full copy. Only one is prepared at a time: a second click is told so. */
export const startArchiveExport = defineCommand({
  name: "export.archive.start",
  async run(tx, ctx, input: { jobId: string }) {
    const [running] = await tx
      .select({ id: exportJob.id })
      .from(exportJob)
      .where(and(eq(exportJob.orgId, ctx.orgId), eq(exportJob.status, "running")));
    if (running) throw new ExportError("busy", "An archive is already being prepared.");
    await tx
      .insert(exportJob)
      .values({ id: input.jobId, orgId: ctx.orgId, requestedBy: ctx.actorId });
    return { jobId: input.jobId };
  },
  audit: (_input, output) => ({ jobId: output.jobId }),
  details: (_input, output) => ({ entity: "export_job", entityId: output.jobId }),
});
