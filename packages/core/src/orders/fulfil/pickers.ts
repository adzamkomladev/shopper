import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { onlineOrder } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import { orderMessage } from "../../schemas/orders/messages";
import type { NotificationDeps } from "../../notifications/types";

/**
 * Tells the store's screens an accepted order is due for picking: the message goes out on the store's realtime
 * channel, so an open order queue refetches at once. A shell with no realtime acks it: queues also refetch on a timer.
 */
export async function deliverPickDue(deps: NotificationDeps, delivery: Delivery) {
  const { orderId } = v.parse(orderMessage, delivery.message).payload;
  const [order] = await deps.db
    .select({ storeId: onlineOrder.storeId })
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, delivery.message.orgId), eq(onlineOrder.id, orderId)));
  if (order) await deps.realtime?.publish(delivery.message.orgId, order.storeId, delivery.message);
  await delivery.ack();
}
