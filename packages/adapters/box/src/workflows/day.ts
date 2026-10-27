import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { runStoreDay, storeDayId, storeDayParams } from "@shopper/core/reports";
import { and, eq, ne } from "drizzle-orm";
import { store, workflowRun, type ShopperDatabase } from "@shopper/db-pg";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Queue,
  type WorkflowLauncher,
} from "@shopper/ports";

// ponytail: in-process, so a restart forgets the sleeping days; `relaunch` starts them again on boot (their finished
// steps replay from workflow_step). Rivet Workflows take over on Day 36.
/** The box shell for store days; each day starts the next through this launcher. `idle` waits for started days. */
export function boxStoreDays(options: { database: ShopperDatabase; queue?: Queue }) {
  const running = new Map<string, Promise<void>>();
  const launcher: WorkflowLauncher = {
    send: async (id) => void v.parse(workflowInstanceIdSchema, id),
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      v.parse(storeDayParams, params);
      if (running.has(instanceId)) return;
      running.set(
        instanceId,
        runStoreDay(memoryWorkflow(instanceId), deps, params).catch((error: unknown) => {
          running.delete(instanceId);
          console.error({ event: "store_day.failed", instanceId, error });
        }),
      );
    },
  };
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    appVersion: buildInfo.version,
    queue: options.queue,
    storeDays: launcher,
  };
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
    idle: async () => void (await Promise.all(running.values())),
  };
}
