// Day 34: the shopper is told as their order moves: ready for pickup, out for delivery, delivered. Each text goes out once
// however often the message is delivered; a change to the order is said plainly; and the order page shows the timeline.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import { deliverNotification } from "@shopper/core/notifications";
import {
  acceptStoreOrder,
  dispatchStoreOrder,
  finishStoreOrder,
  handOverStoreOrder,
  recordPick,
  startPicking,
} from "@shopper/core/orders";
import { deliveryOf } from "../../../support/payments/orders/reads";
import { fulfilWorld } from "../../../support/orders/fulfil";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 60_000, pickLeadMs: 0 });
  await f.world.db
    .update(schema.branchFulfilment)
    .set({ delivery: true, deliveryFee: money(100_000) })
    .where(eq(schema.branchFulfilment.branchId, f.shop.branches[0]));
}, 120_000);
afterAll(async () => {
  await f?.close();
});

const texts: { to: string[]; message: string }[] = [];
const sms = {
  send: async (to: string[], message: string) => void texts.push({ to, message }),
} as never;
const deps = () => ({ db: f.world.db, appVersion: "test", sms });
const told = (order: { id: string }, status: string) =>
  f.world.sent.filter(
    (m) =>
      m.type === "order.status" &&
      (m.payload as { orderId: string; status: string }).orderId === order.id &&
      (m.payload as { status: string }).status === status,
  );
const deliver = async (message: (typeof f.world.sent)[number], channels = deps()) => {
  const { delivery, answers } = deliveryOf(message);
  await deliverNotification(channels, delivery);
  return answers;
};
const start = async (over: Record<string, unknown> = {}) => {
  const order = await f.paid(over);
  await f.slotIn(order, 200, 120_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await startPicking(f.world.db, f.ctx, { id: order.id });
  const lines = await f.lines(order);
  return { order, lines };
};
const pickAll = async (
  order: { id: string },
  lines: { id: string; quantityThousandths: number; productId: string | null }[],
) => {
  for (const line of lines.filter((l) => l.productId))
    await recordPick(f.world.db, f.ctx, {
      id: order.id,
      lineId: line.id,
      pickedThousandths: line.quantityThousandths,
    });
};

test("a pickup order texts once when it is ready and says nothing more when it is collected", async () => {
  texts.length = 0;
  const { order, lines } = await start();
  await pickAll(order, lines);
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const [message] = told(order, "ready");
  expect(message).toBeDefined();
  for (let i = 0; i < 2; i++) expect(await deliver(message!)).toEqual({ ack: 1, retry: 0 });
  expect(texts).toHaveLength(1);
  expect(texts[0]).toMatchObject({ to: ["0241234567"] });
  expect(texts[0]!.message).toMatch(/ready for pickup at Osu/);
  await handOverStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect(await deliver(told(order, "completed")[0]!)).toEqual({ ack: 1, retry: 0 });
  expect(texts).toHaveLength(1);
});

test("a delivery order is silent when ready, then texts when it goes out and when it arrives", async () => {
  texts.length = 0;
  const { order, lines } = await start({
    fulfilment: "delivery",
    address: { line1: "12 Ring Road", area: "Osu", city: "Accra" },
  });
  await pickAll(order, lines);
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect(await deliver(told(order, "ready")[0]!)).toEqual({ ack: 1, retry: 0 });
  expect(texts).toHaveLength(0);
  await dispatchStoreOrder(f.world.db, f.ctx, order.id);
  await deliver(told(order, "out_for_delivery")[0]!);
  expect(texts.at(-1)!.message).toMatch(/on its way/);
  await handOverStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await deliver(told(order, "completed")[0]!);
  expect(texts.at(-1)!.message).toMatch(/delivered/);
  expect(texts).toHaveLength(2);
});

test("an order that was changed says what came back to the shopper", async () => {
  texts.length = 0;
  const { order, lines } = await start();
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: lines[0]!.id,
    pickedThousandths: 2_000,
  });
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: lines[1]!.id,
    pickedThousandths: 1_000,
  });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await deliver(told(order, "ready")[0]!);
  expect(texts[0]!.message).toMatch(/ready for pickup/);
  expect(texts[0]!.message).toContain("GH₵ 9.25");
});

test("a shell without SMS credentials retries the message and tells nothing", async () => {
  texts.length = 0;
  const { order, lines } = await start();
  await pickAll(order, lines);
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect(
    await deliver(told(order, "ready")[0]!, { db: f.world.db, appVersion: "test" } as never),
  ).toEqual({
    ack: 0,
    retry: 1,
  });
  expect(texts).toHaveLength(0);
  // Later, with credentials, it goes out.
  await deliver(told(order, "ready")[0]!);
  expect(texts).toHaveLength(1);
});

test("an order nobody has picked yet reads with no adjustment and no review, as the shop's page expects", async () => {
  const order = await f.paid();
  const view = await f.view(order);
  expect(view).toMatchObject({ adjustment: null, review: null, canReview: false });
  expect(view.lines.every((line: { pick: unknown }) => line.pick === null)).toBe(true);
});

test("the shopper's order page shows the timeline, what was changed, and nothing to anyone without the key", async () => {
  const { order, lines } = await start();
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: lines[0]!.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: lines[1]!.id,
    pickedThousandths: 1_500,
  });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const view = await f.view(order);
  expect(view.status).toBe("ready");
  expect(view.timeline.map((event: { status: string }) => event.status)).toEqual(
    expect.arrayContaining(["placed", "paid", "accepted", "picking", "ready"]),
  );
  expect(view.adjustment).toMatchObject({
    beforeGross: 877_500,
    afterGross: 827_500,
    refundAmount: 50_000,
  });
  expect(view.lines[0].pick).toMatchObject({
    outcome: "substituted",
    pickedThousandths: 1_000,
    substitute: { name: "Palm oil 1L", quantityThousandths: 1_000, gross: 250_000 },
  });
  const stranger = await f.http.request(
    `/shop/${f.world.a.slug}/orders/${order.id}?t=${crypto.randomUUID()}`,
  );
  expect(stranger.status).toBe(404);
});

test("a shopper cancels an order they have not paid for with their key; nobody else can, and a paid order is the store's", async () => {
  const order = await f.place();
  const mine = await f.http.request(`/shop/${f.world.a.slug}/orders/${order.id}/cancel`, {
    body: { key: order.key },
  });
  expect(mine.status).toBe(200);
  expect(((await mine.json()) as { status: string }).status).toBe("cancelled");
  expect((await f.holds(order)).every((hold) => hold.releaseReason === "cancelled")).toBe(true);

  const other = await f.place();
  const wrong = await f.http.request(`/shop/${f.world.a.slug}/orders/${other.id}/cancel`, {
    body: { key: crypto.randomUUID() },
  });
  expect(wrong.status).toBe(404);
  expect((await f.row(other)).status).toBe("placed");

  const paid = await f.paid();
  const late = await f.http.request(`/shop/${f.world.a.slug}/orders/${paid.id}/cancel`, {
    body: { key: paid.key },
  });
  expect(late.status).toBe(409);
  expect((await f.row(paid)).status).toBe("paid");
});
