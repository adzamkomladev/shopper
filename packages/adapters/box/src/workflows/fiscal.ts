import { and, eq, isNull, max } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import {
  fiscalArchiveId,
  fiscalArchiveParams,
  fiscalHour,
  runFiscalArchive,
} from "@shopper/core/fiscal";
import { fiscalDoc, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** The box shell for the hourly fiscal archive; `relaunch` at boot covers bundles a memory engine forgot. */
export function boxFiscalArchive(
  options: { database: ShopperDatabase; blobs: Blobs },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    blobs: options.blobs,
    appVersion: buildInfo.version,
  };
  const launcher = launch("fiscal-archive", fiscalArchiveParams, (flow, params) =>
    runFiscalArchive(flow, deps, params),
  );
  return {
    launcher,
    /** At boot: each store with accepted documents not yet bundled gets the bundle of its latest hour. */
    async relaunch() {
      const rows = await options.database
        .select({
          orgId: fiscalDoc.orgId,
          storeId: fiscalDoc.storeId,
          latest: max(fiscalDoc.acceptedAt),
        })
        .from(fiscalDoc)
        .where(and(eq(fiscalDoc.status, "accepted"), isNull(fiscalDoc.archiveId)))
        .groupBy(fiscalDoc.orgId, fiscalDoc.storeId);
      for (const row of rows) {
        const hour = fiscalHour(row.latest!);
        await launcher.start(fiscalArchiveId(row.orgId, row.storeId, hour), {
          orgId: row.orgId,
          storeId: row.storeId,
          hour: hour.toISOString(),
        });
      }
    },
  };
}
