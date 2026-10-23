import type { Delivery } from "@shopper/ports";
import { deliverAccountMessage, deliverStatement, deliverTierNotice } from "../customers";
import { deliverStockAlert } from "../stock";
import type { NotificationDeps } from "./types";
export type { NotificationDeps } from "./types";

/**
 * The notification queue's one consumer: each message type goes to its own delivery. A channel the shell has no
 * credentials for retries, and dead-letters, rather than dropping the message.
 */
export async function deliverNotification(deps: NotificationDeps, delivery: Delivery) {
  switch (delivery.message.type) {
    case "stock.low":
      if (!deps.sms) return await delivery.retry();
      return await deliverStockAlert(deps.db, deps.sms, delivery, deps.appVersion);
    case "statement.send":
      return await deliverStatement(deps, delivery);
    case "tier.notice":
      return await deliverTierNotice(deps, delivery);
    case "account.wake":
    case "account.settings":
      return await deliverAccountMessage(deps, delivery);
    default:
      console.error({ event: "notification.unknown_type", type: delivery.message.type });
      return await delivery.retry();
  }
}
