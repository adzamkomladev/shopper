import {
  accountFlowParams,
  ledgerCustomers,
  runAccount,
  type AccountFlowDeps,
} from "@shopper/core/customers";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** One loop per customer with a ledger. `relaunch` on boot starts every account; each finds its next due moment. */
export function boxAccountFlows(deps: AccountFlowDeps, launch: Launch = memoryLaunch) {
  const flows = launch(
    "account",
    accountFlowParams,
    (flow, params) => runAccount(flow, deps, params),
    {
      loop: true,
    },
  );
  return {
    ...flows,
    async relaunch() {
      const rows = await deps.withDatabase((db) => ledgerCustomers(db));
      for (const row of rows) await flows.start(row.id, { orgId: row.org_id, customerId: row.id });
    },
  };
}
