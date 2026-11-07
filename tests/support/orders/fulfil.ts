// A paid online order, and the store's side of fulfilling it, on top of orderPayWorld.
//   const f = await fulfilWorld({ acceptWithinMs? })
//   f.paid(over?)            -> an order paid by card (the workflow is waiting for the store)
//   f.ctx                    -> a staff command context
//   f.flows                  -> the order workflow launcher (send events)
//   f.slotIn(order, startMs, lengthMs) -> moves the order's slot, to drive the workflow's timers
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { refundOrderPayment } from "@shopper/core/orders";
import { orderPayWorld } from "../payments/orders/world";

type Options = Parameters<typeof orderPayWorld>[0] & {
  pickLeadMs?: number;
  collectWithinMs?: number;
};

export async function fulfilWorld(options: Options = {}) {
  const w = await orderPayWorld(options);
  const ctx = { ...w.world.a.context, queue: w.world.queue, appVersion: "test" };
  const paid = async (over: Record<string, unknown> = {}) => {
    const order = await w.place(over);
    const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
    w.fake.knownCharge(reference, w.pesewas(order.gross));
    await w.paystackEvent(reference, w.pesewas(order.gross));
    return { ...order, reference };
  };
  const slotIn = (order: { id: string }, startMs: number, lengthMs: number) =>
    w.world.db
      .update(schema.onlineOrder)
      .set({
        slotStart: new Date(Date.now() + startMs),
        slotEnd: new Date(Date.now() + startMs + lengthMs),
      })
      .where(eq(schema.onlineOrder.id, order.id));
  const run = async (order: { id: string }) =>
    (
      await w.world.db
        .select()
        .from(schema.workflowRun)
        .where(eq(schema.workflowRun.instanceId, order.id))
    )[0];
  const events = async (order: { id: string }) =>
    (
      await w.world.db
        .select()
        .from(schema.onlineOrderEvent)
        .where(eq(schema.onlineOrderEvent.orderId, order.id))
    ).map((row) => row.status);
  const refundCalls = () => w.fake.requests.filter((request) => request.path === "/refund");
  /** What the notification consumer does with each queued `order.refund`: asks the provider, once per refund. */
  const sendRefunds = async () => {
    for (const message of w.world.sent.filter((sent) => sent.type === "order.refund"))
      await refundOrderPayment(
        { ...w.deps, paystack: w.paystack },
        (message.payload as { id: string }).id,
        w.world.a.orgId,
      );
  };
  return { ...w, ctx, sendRefunds, flows: w.orderFlows, paid, slotIn, run, events, refundCalls };
}
