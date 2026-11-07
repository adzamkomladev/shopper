import { authFlowParamsSchema, runAuthFlow, type AuthFlowDeps } from "@shopper/auth";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

// PostgreSQL expiry stays authoritative for invitation and reset links, whichever engine runs the wait.
export function boxAuthFlows(deps: AuthFlowDeps, launch: Launch = memoryLaunch) {
  return launch("auth", authFlowParamsSchema, (flow, params) => runAuthFlow(flow, deps, params));
}
