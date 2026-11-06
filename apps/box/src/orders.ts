import { buildInfo } from "@shopper/config";
import { boxOnlineOrders, boxStockHolds } from "@shopper/adapters-box";

/**
 * The box's online orders: each order's workflow, and the timers that free stock nobody paid for. Holds still open
 * from before a restart get their timers back on boot.
 */
export function boxOrders(database: Parameters<typeof boxStockHolds>[0]["db"]) {
  const holds = boxStockHolds({ db: database, appVersion: buildInfo.version });
  holds.rearm().catch((error: unknown) => console.error({ event: "stock.rearm_failed", error }));
  return {
    orderFlows: boxOnlineOrders({
      withDatabase: (run) => run(database),
      appVersion: buildInfo.version,
    }),
    stockHolds: holds.holds,
  };
}
