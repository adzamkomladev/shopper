import {
  accountFlowParams,
  ledgerCustomers,
  runAccount,
  type AccountFlowDeps,
} from "@shopper/core/customers";
import { boxLoopFlows } from "./loop";

// ponytail: timers live in this process; a restart loses them, so `relaunch` on boot starts every account again and
// each finds its own next due moment in PostgreSQL. Rivet Workflows take over on Day 36.
export function boxAccountFlows(deps: AccountFlowDeps) {
  const flows = boxLoopFlows("account.workflow", accountFlowParams, (flow, params) =>
    runAccount(flow, deps, params),
  );
  return {
    ...flows,
    async relaunch() {
      const rows = await deps.withDatabase((db) => ledgerCustomers(db));
      for (const row of rows) await flows.start(row.id, { orgId: row.org_id, customerId: row.id });
    },
  };
}
