import { eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { archiveImportId, archiveImportParams, runArchiveImport } from "@shopper/export";
import { archiveImport, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** The box shell for importing an archive (a cloud → box move lands here); `relaunch` restarts one a restart cut off. */
export function boxArchiveImport(
  options: { database: ShopperDatabase; blobs: Blobs },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    blobs: options.blobs,
    appVersion: buildInfo.version,
  };
  const launcher = launch("archive-import", archiveImportParams, (flow, params) =>
    runArchiveImport(flow, deps, params),
  );
  return {
    launcher,
    async relaunch() {
      const running = await options.database
        .select({ orgId: archiveImport.orgId, importId: archiveImport.id })
        .from(archiveImport)
        .where(eq(archiveImport.status, "importing"));
      for (const row of running) await launcher.start(archiveImportId(row.importId), row);
    },
  };
}
