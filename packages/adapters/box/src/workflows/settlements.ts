import { buildInfo } from "@shopper/config";
import { runSettlement, settlementParams, type SettlementDeps } from "@shopper/core/payments";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** The box shell for the daily Paystack settlement fetch; `idle` settles once every started fetch has finished. */
export function boxSettlements(
  options: { database: ShopperDatabase; paystack: SettlementDeps["paystack"] },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    paystack: options.paystack,
    appVersion: buildInfo.version,
  };
  const launcher = launch("settlement", settlementParams, (flow, params) =>
    runSettlement(flow, deps, params),
  );
  return { launcher, idle: launcher.idle };
}
