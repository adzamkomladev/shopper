import * as v from "valibot";
import { and, eq, isNull, max } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import {
  fiscalArchiveId,
  fiscalArchiveParams,
  fiscalHour,
  runFiscalArchive,
} from "@shopper/core/fiscal";
import { fiscalDoc, type ShopperDatabase } from "@shopper/db-pg";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Blobs,
  type WorkflowLauncher,
} from "@shopper/ports";

// ponytail: in-process timers, so `relaunch` at boot starts a bundle for every store with unarchived documents; Rivet
// Workflows replace this on Day 36.
/** The box shell for the hourly fiscal archive. */
export function boxFiscalArchive(options: { database: ShopperDatabase; blobs: Blobs }) {
  const started = new Set<string>();
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    blobs: options.blobs,
    appVersion: buildInfo.version,
  };
  const launcher: WorkflowLauncher = {
    send: async (id) => void v.parse(workflowInstanceIdSchema, id),
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      v.parse(fiscalArchiveParams, params);
      if (started.has(instanceId)) return;
      started.add(instanceId);
      runFiscalArchive(memoryWorkflow(instanceId), deps, params).catch((error: unknown) => {
        started.delete(instanceId);
        console.error({ event: "fiscal.archive_failed", instanceId, error });
      });
    },
  };
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
