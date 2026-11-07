import * as v from "valibot";
import {
  orderParams,
  orderPaymentParams,
  reviewInstanceId,
  runOnlineOrder,
  runOrderPayment,
  runOrderReview,
  type OrderFlowDeps,
  type OrderPaymentDeps,
  type ReviewFlowDeps,
} from "@shopper/core/orders";
import type { Json } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

// On the memory engine a restart loses the waits; the StockHold timer still frees the stock.
export function boxOnlineOrders(deps: OrderFlowDeps, launch: Launch = memoryLaunch) {
  return launch("online-order", orderParams, (flow, params) => runOnlineOrder(flow, deps, params));
}

// On the memory engine a restart loses the waits; the attempt is then settled by its webhook or the hold timer.
export function boxOrderPayments(deps: OrderPaymentDeps, launch: Launch = memoryLaunch) {
  return launch("order-payment", orderPaymentParams, (flow, params) =>
    runOrderPayment(flow, deps, params),
  );
}

/** The review request for an order; an id that is not the order's review id starts nothing. */
export function boxOrderReviews(deps: ReviewFlowDeps, launch: Launch = memoryLaunch) {
  const flows = launch("order-review", orderParams, (flow, params) =>
    runOrderReview(flow, deps, params),
  );
  return {
    ...flows,
    async start(id: string, params: Json) {
      if (id === reviewInstanceId(v.parse(orderParams, params).id)) await flows.start(id, params);
    },
  };
}
