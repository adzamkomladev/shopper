import { kycFlowParams, runKyc, type KycFlowDeps } from "@shopper/auth/kyc";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

// The deadlines in PostgreSQL decide on either engine: a late answer is refused and a lapsed case is expired by the
// command that meets it.
export function boxKycFlows(deps: KycFlowDeps, launch: Launch = memoryLaunch) {
  return launch("kyc", kycFlowParams, (flow, params) => runKyc(flow, deps, params));
}
