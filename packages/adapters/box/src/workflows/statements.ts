import {
  runStatementSchedule,
  statementFlowParams,
  type StatementFlowDeps,
} from "@shopper/core/customers";
import { boxLoopFlows } from "./loop";

// ponytail: a box restart loses the timer until the next settings change; Rivet Workflows take over on Day 36.
export const boxStatementFlows = (deps: StatementFlowDeps) =>
  boxLoopFlows("statement.schedule", statementFlowParams, (flow, params) =>
    runStatementSchedule(flow, deps, params),
  );
