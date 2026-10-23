import * as v from "valibot";
import {
  accountFlowParams,
  ledgerCustomers,
  runAccount,
  type AccountFlowDeps,
} from "@shopper/core/customers";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// ponytail: timers live in this process; a restart loses them, so `relaunch` on boot starts every account again and
// each finds its own next due moment in PostgreSQL. Rivet Workflows take over on Day 36.
export function boxAccountFlows(
  deps: AccountFlowDeps,
): WorkflowLauncher & { relaunch(): Promise<void> } {
  // Each run gets a fresh engine key, so an account that ended can start again without replaying old steps.
  const running = new Map<string, string>();
  const again = new Set<string>();
  let runs = 0;
  const launcher: WorkflowLauncher & { relaunch(): Promise<void> } = {
    async start(id, raw) {
      v.parse(workflowInstanceIdSchema, id);
      const params = v.parse(accountFlowParams, raw);
      const key = running.get(id);
      if (key) {
        again.add(id);
        return memoryWorkflow(key).send(key, "wake", {});
      }
      const engine = `${id}_${++runs}`;
      running.set(id, engine);
      runAccount({ ...memoryWorkflow(engine), instanceId: id }, deps, params)
        .catch((error: unknown) =>
          console.error({ event: "account.workflow.failed", instanceId: id, error }),
        )
        .finally(() => {
          running.delete(id);
          // A wake that landed as the run was ending must not be lost: look once more.
          if (again.delete(id)) void launcher.start(id, params);
        });
    },
    async send(id, type, payload) {
      v.parse(workflowInstanceIdSchema, id);
      const key = running.get(id);
      if (key) await memoryWorkflow(key).send(key, type, payload);
    },
    async relaunch() {
      const rows = await deps.withDatabase((db) => ledgerCustomers(db));
      for (const row of rows)
        await launcher.start(row.id, { orgId: row.org_id, customerId: row.id });
    },
  };
  return launcher;
}
