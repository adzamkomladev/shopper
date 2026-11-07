import { kybFlowParams, runKyb, type KybFlowDeps } from "@shopper/core/kyb";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

// ponytail: the box takes no payouts, so it never starts one; this shell carries the shared function for parity and
// the tests.
export function boxKybFlows(deps: KybFlowDeps, launch: Launch = memoryLaunch) {
  return launch("kyb", kybFlowParams, (flow, params) => runKyb(flow, deps, params), { loop: true });
}
