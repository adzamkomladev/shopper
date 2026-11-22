// v1.5 Day 52: the box goes offline mid-order. Its branch pauses after 5 silent minutes in hours; a paid order it has
// not taken passes its deadline and the shopper is offered a full refund or the wait (never refunded behind their
// back while the box may still come back). Cancelling refunds once; waiting lets the box take it when it returns;
// nobody deciding by the end of the slot refunds it as before. (A cloud shop's unaccepted order is still refunded at
// its deadline: tests/integration/payments/orders/refund.test.ts.)
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { deliverNotification } from "@shopper/core/notifications";
import { listSlots } from "@shopper/core/orders";
import { applyRelayEvents } from "@shopper/core/relay";
import { deliveryOf } from "../../support/payments/orders/reads";
import { inboxWorld } from "../../support/relay/inbox";

let w: Awaited<ReturnType<typeof inboxWorld>>;
beforeAll(async () => {
  w = await inboxWorld({ acceptWithinMs: 2_000 });
  await w.stock(w.f.products.oil, 50);
}, 180_000);
afterAll(async () => w?.close());

const oil = () => ({ lines: [{ productId: w.f.products.oil, quantityThousandths: 1_000 }] });
const seen = (at: Date) =>
  w.f.world.db
    .update(schema.relayBox)
    .set({ lastSeenAt: at })
    .where(eq(schema.relayBox.orgId, w.orgId));
const overdue = (id: string) =>
  expect
    .poll(async () => (await w.relayOrder(id))?.overdueAt ?? null, { timeout: 15_000 })
    .not.toBeNull();
const cancel = (order: { id: string; key: string }) =>
  w.f.http.request(`/shop/${w.f.world.a.slug}/orders/${order.id}/cancel`, {
    body: { key: order.key },
  });

test("box offline mid-order: paused, past the deadline the shopper is offered and takes a refund", async () => {
  await seen(new Date());
  const order = await w.f.paid(oil());
  // The box falls silent before it pulls the order: in hours, its branch pauses (new orders are refused, Day 49).
  const inHours = new Date(`${new Date().toISOString().slice(0, 10)}T10:00:00Z`);
  await seen(new Date(inHours.getTime() - 6 * 60_000));
  expect((await listSlots(w.f.world.db, w.orgId, w.main, inHours)).paused).toBe(true);

  // Past the deadline: offered, still paid, nothing refunded behind the shopper's back.
  await overdue(order.id);
  expect((await w.relayOrder(order.id))?.status).toBe("paid");
  expect(await w.f.refunds(order)).toHaveLength(0);
  expect((await w.f.view(order)).overdue).toBe(true);
  const offer = w.f.world.sent.find(
    (m) => m.type === "order.overdue" && (m.payload as { orderId: string }).orderId === order.id,
  );
  const texts: string[] = [];
  const sms = { send: async (_to: string[], text: string) => void texts.push(text) } as never;
  await deliverNotification(
    { db: w.f.world.db, appVersion: "test", sms },
    deliveryOf(offer!).delivery,
  );
  expect(texts.join()).toMatch(/waiting for the shop.*full refund.*keep waiting/);

  // The shopper takes the refund: once, with its money sent and the shopper told.
  const cancelled = await cancel(order);
  expect(cancelled.status).toBe(200);
  expect(await cancelled.json()).toMatchObject({ status: "refunded", overdue: false });
  expect((await w.f.refunds(order)).map((refund) => refund.reason)).toEqual(["cancelled"]);
  expect((await cancel(order)).status).toBe(409);
  const before = w.f.refundCalls().length;
  await w.f.sendRefunds();
  expect(w.f.refundCalls().length).toBe(before + 1);
  // The box comes back: it never takes the refunded order, and its stock is untouched.
  const shelf = await w.boxAvailable(w.f.products.oil);
  await w.run();
  expect(await w.boxOrder(order.id)).toBeUndefined();
  expect(await w.boxAvailable(w.f.products.oil)).toBe(shelf);
});

test("box offline mid-order: the shopper waits and the box takes it when it is back", async () => {
  const order = await w.f.paid(oil());
  await overdue(order.id);
  await w.run();
  expect((await w.boxOrder(order.id))?.status).toBe("accepted");
  await expect.poll(async () => (await w.relayOrder(order.id))?.status).toBe("accepted");
  expect((await w.f.view(order)).overdue).toBe(false);
  // Confirmed by the shop, it is no longer the shopper's to cancel.
  expect((await cancel(order)).status).toBe(409);
  expect(await w.f.refunds(order)).toHaveLength(0);
});

test("an order on time is not the shopper's to cancel, and an overdue one nobody takes is refunded at its slot's end", async () => {
  const onTime = await w.f.paid(oil());
  expect((await cancel(onTime)).status).toBe(409);
  expect((await w.relayOrder(onTime.id))?.status).toBe("paid");

  const order = await w.f.paid(oil());
  await w.f.slotIn(order, 0, 4_000);
  await overdue(order.id);
  await expect
    .poll(async () => (await w.relayOrder(order.id))?.status, { timeout: 15_000 })
    .toBe("refunded");
  expect((await w.f.refunds(order)).map((refund) => refund.reason)).toEqual(["not_accepted"]);
});

test("a box that accepts after the slot has ended is refused: the shopper is refunded, once", async () => {
  const order = await w.f.paid(oil());
  await w.f.world.db
    .update(schema.onlineOrder)
    .set({ slotStart: new Date(Date.now() - 3_600_000), slotEnd: new Date(Date.now() - 60_000) })
    .where(eq(schema.onlineOrder.id, order.id));
  // The box's accept lands before the workflow's own refund: the relay refunds instead, and tells the box so.
  const told = await applyRelayEvents(w.f.world.db, w.f.ctx, w.f.flows, {
    events: [{ id: order.id, status: "accepted" }],
    open: [],
  });
  expect(told.refunded).toEqual([order.id]);
  expect((await w.relayOrder(order.id))?.status).toBe("refunded");
  expect(await w.f.refunds(order)).toHaveLength(1);
});
