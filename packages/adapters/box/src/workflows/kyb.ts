import { kybFlowParams, runKyb, type KybFlowDeps } from "@shopper/core/kyb";
import { boxLoopFlows } from "./loop";

// ponytail: the box takes no payouts, so it never starts one; this shell carries the shared function for parity and
// the tests. Timers are lost on restart until Rivet Workflows arrive on Day 36.
export function boxKybFlows(deps: KybFlowDeps) {
  return boxLoopFlows("kyb", kybFlowParams, (flow, params) => runKyb(flow, deps, params));
}
