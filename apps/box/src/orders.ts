import { buildInfo } from "@shopper/config";
import {
  boxOnlineOrders,
  boxOrderPayments,
  boxOrderReviews,
  boxStockHolds,
  type Launch,
} from "@shopper/adapters-box";
import type { Queue } from "@shopper/ports";
import type { createHubtel } from "@shopper/core/payments/hubtel";
import type { createPaystack } from "@shopper/core/payments/paystack";

type Database = Parameters<typeof boxStockHolds>[0]["db"];

/**
 * The box's online orders: each order's workflow, the payment attempts that settle it, and the timers that free
 * stock nobody paid for. Holds still open from before a restart get their timers back on boot. Without a Paystack
 * key orders can be placed but not paid.
 */
export function boxOrders(
  database: Database,
  providers: {
    paystack?: ReturnType<typeof createPaystack>;
    hubtel?: ReturnType<typeof createHubtel>;
  },
  /** The notification queue, which the box builds after its orders: read when a payment settles. */
  notifications: () => Queue | undefined,
  launch: Launch,
) {
  const holds = boxStockHolds({ db: database, appVersion: buildInfo.version });
  holds.rearm().catch((error: unknown) => console.error({ event: "stock.rearm_failed", error }));
  const deps = {
    withDatabase: <T>(run: (db: Database) => Promise<T>) => run(database),
    appVersion: buildInfo.version,
  };
  const orderFlows = boxOnlineOrders(
    { ...deps, paystack: providers.paystack, notifications },
    launch,
  );
  return {
    orderFlows,
    orderReviews: boxOrderReviews({ ...deps, notifications }, launch),
    stockHolds: holds.holds,
    orderPayments: providers.paystack
      ? boxOrderPayments(
          {
            ...deps,
            paystack: providers.paystack,
            hubtel: providers.hubtel,
            orders: orderFlows,
            notifications,
          },
          launch,
        )
      : undefined,
    paystack: providers.paystack,
    refunds: providers.paystack && { ...deps, paystack: providers.paystack },
  };
}
