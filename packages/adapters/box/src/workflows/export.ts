import { eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { archiveExportParams, exportArchiveId, runArchiveExport } from "@shopper/export";
import { exportJob, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** The box shell for a full copy of the business; `relaunch` at boot restarts an archive a memory engine forgot. */
export function boxArchiveExport(
  options: { database: ShopperDatabase; blobs: Blobs },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    blobs: options.blobs,
    appVersion: buildInfo.version,
  };
  const launcher = launch("export-archive", archiveExportParams, (flow, params) =>
    runArchiveExport(flow, deps, params),
  );
  return {
    launcher,
    /** At boot: every archive still marked running starts again (the dump rewrites the same parts). */
    async relaunch() {
      const running = await options.database
        .select({ orgId: exportJob.orgId, jobId: exportJob.id })
        .from(exportJob)
        .where(eq(exportJob.status, "running"));
      for (const job of running) await launcher.start(exportArchiveId(job.orgId, job.jobId), job);
    },
  };
}
