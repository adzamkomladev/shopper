// The notification queue the test servers share: a box queue that records what it delivers.
import { boxQueue } from "@shopper/adapters-box";
import { NOTIFICATION_RETRY, type Envelope } from "@shopper/ports";

export const delivered: Envelope[] = [];
export const notifications = boxQueue(NOTIFICATION_RETRY, async (delivery) => {
  delivered.push(delivery.message);
  await delivery.ack();
});

/** Everything sent so far, once the queue has delivered it. */
export async function sentMessages() {
  await notifications.idle();
  return delivered;
}
