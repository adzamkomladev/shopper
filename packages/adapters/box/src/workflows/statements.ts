import {
  runStatementSchedule,
  scheduledOrgs,
  statementFlowParams,
  type StatementFlowDeps,
} from "@shopper/core/customers";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** One monthly statement loop per org. `relaunch` on boot starts each; a start counts from the last period sent. */
export function boxStatementFlows(deps: StatementFlowDeps, launch: Launch = memoryLaunch) {
  const flows = launch(
    "statement-schedule",
    statementFlowParams,
    (flow, params) => runStatementSchedule(flow, deps, params),
    { loop: true },
  );
  return {
    ...flows,
    async relaunch() {
      for (const params of await deps.withDatabase((db) => scheduledOrgs(db)))
        await flows.start(params.orgId, params);
    },
  };
}
