import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { runSettlement, settlementParams, type SettlementDeps } from "@shopper/core/payments";
import type { ShopperDatabase } from "@shopper/db-pg";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

/** The box shell for the daily Paystack settlement fetch; `idle` settles once every started fetch has finished. */
export function boxSettlements(options: {
  database: ShopperDatabase;
  paystack: SettlementDeps["paystack"];
}) {
  const running = new Map<string, Promise<void>>();
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    paystack: options.paystack,
    appVersion: buildInfo.version,
  };
  const launcher: WorkflowLauncher = {
    send: async (id) => void v.parse(workflowInstanceIdSchema, id),
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      v.parse(settlementParams, params);
      if (running.has(instanceId)) return;
      running.set(
        instanceId,
        runSettlement(memoryWorkflow(instanceId), deps, params).catch((error: unknown) => {
          running.delete(instanceId);
          console.error({ event: "settlement.failed", instanceId, error });
        }),
      );
    },
  };
  return { launcher, idle: async () => void (await Promise.all(running.values())) };
}
