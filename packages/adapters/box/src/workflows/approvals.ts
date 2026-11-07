import { approvalParams, runApproval, type ApprovalDeps } from "@shopper/core/approvals";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

export function boxApprovals(deps: ApprovalDeps, launch: Launch = memoryLaunch) {
  return launch("approval", approvalParams, (flow, params) => runApproval(flow, deps, params));
}
