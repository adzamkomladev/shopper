import { buildInfo } from "@shopper/config";
import { priceChangeParams, runPriceChange } from "@shopper/core/catalogue";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Realtime } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** Scheduled price changes; `runPriceChange` records a failure in PostgreSQL itself. */
export function boxPriceChange(
  options: { database: ShopperDatabase; realtime: Realtime },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    realtime: options.realtime,
    appVersion: buildInfo.version,
  };
  return {
    launcher: launch("price-change", priceChangeParams, (flow, params) =>
      runPriceChange(flow, deps, params),
    ),
  };
}
