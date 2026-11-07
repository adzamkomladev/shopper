import { buildInfo } from "@shopper/config";
import { runStoreDay, storeDayId, storeDayParams } from "@shopper/core/reports";
import { and, eq, ne } from "drizzle-orm";
import { store, workflowRun, type ShopperDatabase } from "@shopper/db-pg";
import type { Queue, WorkflowLauncher } from "@shopper/ports";
import type { BoxLauncher, Launch } from "../types";
import { memoryLaunch } from "./launch";

/**
 * The box shell for store days; each day starts the next through this launcher. On the memory engine a restart
 * forgets the sleeping days, so `relaunch` starts them again on boot (finished steps replay from workflow_step); on
 * Rivet it is a no-op for every day the engine still runs.
 */
export function boxStoreDays(
  options: { database: ShopperDatabase; queue?: Queue },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    appVersion: buildInfo.version,
    queue: options.queue,
    // Each day starts the next through this same launcher.
    storeDays: {
      start: (id, params) => launcher.start(id, params),
      send: (id, type, payload) => launcher.send(id, type, payload),
    } satisfies WorkflowLauncher,
  };
  const launcher: BoxLauncher = launch("store-day", storeDayParams, (flow, params) =>
    runStoreDay(flow, deps, params),
  );
  return {
    launcher,
    /**
     * As the box boots: every store day the engine forgot before it finished (one interrupted between midnight and
     * its rollup, say), then today's for every store. Returns the ids it started.
     */
    async relaunch(at = new Date()) {
      const day = at.toISOString().slice(0, 10);
      const unfinished = await options.database
        .select({ id: workflowRun.instanceId })
        .from(workflowRun)
        .where(and(eq(workflowRun.type, "store-day"), ne(workflowRun.status, "completed")));
      const stores = await options.database
        .select({ orgId: store.orgId, id: store.id })
        .from(store);
      const days = [
        ...unfinished.map((run) => {
          const [, orgId, storeId, on] = run.id.split("_");
          return { id: run.id, params: { orgId, storeId, day: on } };
        }),
        ...stores.map((row) => ({
          id: storeDayId(row.orgId, row.id, day),
          params: { orgId: row.orgId, storeId: row.id, day },
        })),
      ];
      const ids = [...new Set(days.map((entry) => entry.id))];
      for (const id of ids) await launcher.start(id, days.find((entry) => entry.id === id)!.params);
      return ids;
    },
    idle: launcher.idle,
  };
}
