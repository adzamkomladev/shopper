import { refundParams, runMomoRefund, type MomoDeps } from "@shopper/core/payments";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

export function boxMomoRefund(deps: Omit<MomoDeps, "realtime">, launch: Launch = memoryLaunch) {
  return launch("momo-refund", refundParams, (flow, params) => runMomoRefund(flow, deps, params));
}
