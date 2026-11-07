// A paid online order, and the store's side of fulfilling it, on top of orderPayWorld.
//   const f = await fulfilWorld({ acceptWithinMs? })
//   f.paid(over?)            -> an order paid by card (the workflow is waiting for the store); `{ branch }` picks the branch
//   f.ctx                    -> a staff command context
//   f.flows                  -> the order workflow launcher (send events)
//   f.adjustment(order) / f.picks(order) -> what picking recorded
//   f.lines(order)           -> the order's lines, in order
//   f.substitutes            -> { palm (cheaper oil), basmati (dearer rice), scarce (no stock), single (one unit) } product ids
//   f.receive(productId, unitCost, at) -> a costed receipt at the first branch, as the books value stock
//   f.slotIn(order, startMs, lengthMs) -> moves the order's slot, to drive the workflow's timers
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { refundOrderPayment } from "@shopper/core/orders";
import { money } from "@shopper/money";
import { orderPayWorld } from "../payments/orders/world";

type Options = Parameters<typeof orderPayWorld>[0] & {
  pickLeadMs?: number;
  collectWithinMs?: number;
};

export async function fulfilWorld(options: Options = {}) {
  const w = await orderPayWorld(options);
  const ctx = { ...w.world.a.context, queue: w.world.queue, appVersion: "test" };
  await w.world.db.insert(schema.branchFulfilment).values({
    orgId: w.world.a.orgId,
    branchId: w.shop.branches[1],
    pickup: true,
    delivery: false,
    opens: "00:00",
    closes: "23:00",
    slotMinutes: 60,
    slotCapacity: 50,
    leadMinutes: 0,
  });
  // Substitutes: a cheaper oil, a dearer rice, and a tin the shop has none of.
  const palm = await w.shop.product("Palm oil 1L", { price: 250_000, stock: [100_000, 100_000] });
  const basmati = await w.shop.product("Basmati rice", {
    price: 400_000,
    baseUnit: "kg",
    stock: [100_000, 100_000],
  });
  const scarce = await w.shop.product("Scarce tin", { price: 100_000, stock: [0, 0] });
  // One unit at each branch: two lines cannot both be replaced by it.
  const single = await w.shop.product("Single tin", { price: 100_000, stock: [1_000, 1_000] });
  const lines = (order: { id: string }) =>
    w.world.db
      .select()
      .from(schema.onlineOrderLine)
      .where(eq(schema.onlineOrderLine.orderId, order.id))
      .orderBy(schema.onlineOrderLine.position);
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
  const receive = async (productId: string, unitCost: number, at: Date) => {
    // A receipt is made by a person: the shop's first signed-up user.
    const [actor] = await w.world.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.orgId, w.world.a.orgId))
      .limit(1);
    const [supplier] = await w.world.db
      .insert(schema.supplier)
      .values({ orgId: w.world.a.orgId, name: `Supplier ${crypto.randomUUID()}` })
      .returning();
    const [document] = await w.world.db
      .insert(schema.stockDocument)
      .values({
        orgId: w.world.a.orgId,
        branchId: w.shop.branches[0],
        supplierId: supplier!.id,
        actorId: actor!.id,
        kind: "receipt",
        occurredAt: at,
        contentHash: crypto.randomUUID(),
        payload: {},
      })
      .returning();
    await w.world.db.insert(schema.stockMovement).values({
      orgId: w.world.a.orgId,
      branchId: w.shop.branches[0],
      productId,
      reason: "receipt",
      quantityThousandths: 10_000,
      unitCost: money(unitCost),
      documentId: document!.id,
      occurredAt: at,
    });
  };
  const adjustment = async (order: { id: string }) =>
    (
      await w.world.db
        .select()
        .from(schema.onlineOrderAdjustment)
        .where(eq(schema.onlineOrderAdjustment.orderId, order.id))
    )[0];
  const picks = (order: { id: string }) =>
    w.world.db
      .select()
      .from(schema.onlineOrderPick)
      .where(eq(schema.onlineOrderPick.orderId, order.id));
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
  return {
    ...w,
    ctx,
    sendRefunds,
    substitutes: { palm, basmati, scarce, single },
    lines,
    receive,
    adjustment,
    picks,
    flows: w.orderFlows,
    paid,
    slotIn,
    run,
    events,
    refundCalls,
  };
}
