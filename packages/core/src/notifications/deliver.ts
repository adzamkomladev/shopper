import type { Delivery } from "@shopper/ports";
import { deliverStatement, type StatementDeliveryDeps } from "../customers";
import { deliverStockAlert } from "../stock";

/**
 * The notification queue's one consumer: each message type goes to its own delivery. A channel the shell has no
 * credentials for retries, and dead-letters, rather than dropping the message.
 */
export async function deliverNotification(deps: StatementDeliveryDeps, delivery: Delivery) {
  switch (delivery.message.type) {
    case "stock.low":
      if (!deps.sms) return await delivery.retry();
      return await deliverStockAlert(deps.db, deps.sms, delivery, deps.appVersion);
    case "statement.send":
      return await deliverStatement(deps, delivery);
    default:
      console.error({ event: "notification.unknown_type", type: delivery.message.type });
      return await delivery.retry();
  }
}
