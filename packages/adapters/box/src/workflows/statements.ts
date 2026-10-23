import {
  runStatementSchedule,
  scheduledOrgs,
  statementFlowParams,
  type StatementFlowDeps,
} from "@shopper/core/customers";
import { boxLoopFlows } from "./loop";

// ponytail: timers live in this process; `relaunch` on boot starts every monthly schedule again, and each start
// counts from the last period delivered. Rivet Workflows take over on Day 36.
export function boxStatementFlows(deps: StatementFlowDeps) {
  const flows = boxLoopFlows("statement.schedule", statementFlowParams, (flow, params) =>
    runStatementSchedule(flow, deps, params),
  );
  return {
    ...flows,
    async relaunch() {
      for (const params of await deps.withDatabase((db) => scheduledOrgs(db)))
        await flows.start(params.orgId, params);
    },
  };
}
