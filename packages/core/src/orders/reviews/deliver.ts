import * as v from "valibot";
import { and, eq, isNull } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { onlineOrder, org } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../../customers";
import { orderMessage } from "../../schemas/orders/messages";

/**
 * Texts the shopper to ask how their order went, once: the order remembers it asked. The shop's order page is where
 * they answer (it holds their key), so the text points there; a shell with no SMS credentials retries.
 */
export async function deliverReviewAsk(deps: StatementDeliveryDeps, delivery: Delivery) {
  const orgId = delivery.message.orgId;
  const { orderId } = v.parse(orderMessage, delivery.message).payload;
  const [found] = await deps.db
    .select({ order: onlineOrder, shop: org.name })
    .from(onlineOrder)
    .innerJoin(org, eq(org.id, onlineOrder.orgId))
    .where(
      and(
        eq(onlineOrder.orgId, orgId),
        eq(onlineOrder.id, orderId),
        isNull(onlineOrder.reviewAskedAt),
      ),
    );
  if (!found) return await delivery.ack();
  if (!deps.sms) return await delivery.retry();
  await deps.sms.send(
    [found.order.customerPhone],
    `${found.shop}: how was order ${found.order.receiptNumber ?? found.order.inboxCursor}? Open your order page to rate it. Thank you!`,
  );
  await markAsked(deps.db, { orgId, appVersion: deps.appVersion }, { id: orderId });
  await delivery.ack();
}

const markAsked = defineCommand({
  name: "review.ask.sent",
  async run(tx, ctx, input: { id: string }) {
    await tx
      .update(onlineOrder)
      .set({ reviewAskedAt: new Date() })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, input.id)));
    return input;
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
