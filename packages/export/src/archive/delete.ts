import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { exportJob } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { ExportError } from "./error";
import { exportPrefix } from "./ids";
import { readEntries } from "./download";

/** Removes an archive's parts (never the org's own files, which the archive only points at). */
export const removeArchiveExport = defineCommand({
  name: "export.archive.delete",
  async run(tx, ctx, input: { jobId: string; blobs: Blobs }) {
    const [job] = await tx
      .select()
      .from(exportJob)
      .where(and(eq(exportJob.orgId, ctx.orgId), eq(exportJob.id, input.jobId)));
    if (!job || job.status === "deleted") throw new ExportError("not_found", "No such archive.");
    if (job.status === "running")
      throw new ExportError("running", "This archive is still being prepared.");
    const prefix = exportPrefix(input.jobId);
    const listed =
      job.status === "ready" ? await readEntries(input.blobs, ctx.orgId, input.jobId) : [];
    const keys = [
      ...listed.map((entry) => entry.key).filter((key) => key.startsWith(`${prefix}/`)),
      ...["files.json", "entries.json", "manifest.json", "manifest.sig"].map(
        (name) => `${prefix}/${name}`,
      ),
    ];
    await tx
      .update(exportJob)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(exportJob.id, input.jobId));
    for (const key of new Set(keys)) await input.blobs.delete(ctx.orgId, key);
    return { jobId: input.jobId, parts: new Set(keys).size };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "export_job", entityId: output.jobId }),
});
