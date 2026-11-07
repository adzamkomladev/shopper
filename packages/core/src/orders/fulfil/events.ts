import { onlineOrderEvent, type ShopperTransaction } from "@shopper/db-pg";
import type { orderStatuses } from "@shopper/db-pg";

/** Notes that an order reached a status, once: the shopper's timeline and the record of what they were told. */
export async function recordStatus(
  tx: ShopperTransaction,
  ctx: { orgId: string; actorId?: string },
  orderId: string,
  status: (typeof orderStatuses)[number],
  at = new Date(),
) {
  await tx
    .insert(onlineOrderEvent)
    .values({ orgId: ctx.orgId, orderId, status, actorId: ctx.actorId ?? null, at })
    .onConflictDoNothing({
      target: [onlineOrderEvent.orgId, onlineOrderEvent.orderId, onlineOrderEvent.status],
    });
}
