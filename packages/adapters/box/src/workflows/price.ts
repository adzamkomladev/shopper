import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { priceChangeParams, runPriceChange } from "@shopper/core/catalogue";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Realtime,
  type WorkflowLauncher,
} from "@shopper/ports";

// ponytail: in-process timers, so a box restart drops pending schedules; Rivet Workflows replace this on day 36.
export function boxPriceChange(options: { database: ShopperDatabase; realtime: Realtime }) {
  const started = new Set<string>();
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    realtime: options.realtime,
    appVersion: buildInfo.version,
  };
  const launcher: WorkflowLauncher = {
    send: (id, type, payload) => {
      v.parse(workflowInstanceIdSchema, id);
      return memoryWorkflow(id).send(id, type, payload);
    },
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      v.parse(priceChangeParams, params);
      if (started.has(instanceId)) return;
      started.add(instanceId);
      // runPriceChange records the failure in PostgreSQL; this only keeps the process alive.
      runPriceChange(memoryWorkflow(instanceId), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId, error }),
      );
    },
  };
  return { launcher };
}
