import { momoParams, runMomoPayment, type MomoDeps } from "@shopper/core/payments";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

export function boxMomoPayment(deps: MomoDeps, launch: Launch = memoryLaunch) {
  return launch("momo-payment", momoParams, (flow, params) => runMomoPayment(flow, deps, params));
}
