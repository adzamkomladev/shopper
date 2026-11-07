import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { branch, onlineOrder, onlineOrderAdjustment, onlineOrderEvent, org } from "@shopper/db-pg";
import { formatGHS } from "@shopper/money";
import type { Delivery } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../../customers";
import { orderStatusMessage } from "../../schemas/orders/messages";

/**
 * Tells the shopper their order moved: ready for pickup, out for delivery, delivered. A delivery says nothing when it
 * is merely ready, and a collected order needs no text. Each status is told once (the order's event row remembers),
 * and a shell with no SMS credentials retries rather than dropping it.
 */
export async function deliverOrderStatus(deps: StatementDeliveryDeps, delivery: Delivery) {
  const orgId = delivery.message.orgId;
  const { orderId, status } = v.parse(orderStatusMessage, delivery.message).payload;
  const [found] = await deps.db
    .select({
      order: onlineOrder,
      shop: org.name,
      branchName: branch.name,
      notifiedAt: onlineOrderEvent.notifiedAt,
    })
    .from(onlineOrder)
    .innerJoin(org, eq(org.id, onlineOrder.orgId))
    .innerJoin(
      branch,
      and(eq(branch.orgId, onlineOrder.orgId), eq(branch.id, onlineOrder.branchId)),
    )
    .innerJoin(
      onlineOrderEvent,
      and(
        eq(onlineOrderEvent.orgId, onlineOrder.orgId),
        eq(onlineOrderEvent.orderId, onlineOrder.id),
        eq(onlineOrderEvent.status, status),
      ),
    )
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, orderId)));
  if (!found || found.notifiedAt) return await delivery.ack();
  const order = found.order;
  const [adjustment] = await deps.db
    .select()
    .from(onlineOrderAdjustment)
    .where(and(eq(onlineOrderAdjustment.orgId, orgId), eq(onlineOrderAdjustment.orderId, orderId)));
  const label = `${found.shop}: order ${order.receiptNumber ?? order.inboxCursor}`;
  const changed = !adjustment
    ? ""
    : adjustment.refundAmount > 0
      ? ` We changed some items; ${formatGHS(adjustment.refundAmount)} is on its way back to you.`
      : " We swapped some items; you pay no more than you did.";
  const text = {
    ready:
      order.fulfilment === "pickup" &&
      `${label} is ready for pickup at ${found.branchName}.${changed}`,
    out_for_delivery: `${label} is on its way to you.${changed}`,
    completed: order.fulfilment === "delivery" && `${label} was delivered. Thank you!`,
  }[status];
  if (!text) return await delivery.ack();
  if (!deps.sms) return await delivery.retry();
  await deps.sms.send([order.customerPhone], text);
  await markTold(deps.db, { orgId, appVersion: deps.appVersion }, { orderId, status });
  await delivery.ack();
}

const markTold = defineCommand({
  name: "order.status.told",
  async run(
    tx,
    ctx,
    input: { orderId: string; status: "ready" | "out_for_delivery" | "completed" },
  ) {
    await tx
      .update(onlineOrderEvent)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(onlineOrderEvent.orgId, ctx.orgId),
          eq(onlineOrderEvent.orderId, input.orderId),
          eq(onlineOrderEvent.status, input.status),
        ),
      );
    return input;
  },
  audit: (input) => ({ id: input.orderId, status: input.status }),
  details: (input) => ({ entity: "online_order", entityId: input.orderId }),
});
