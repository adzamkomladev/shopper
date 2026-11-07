// Day 34: after an order is handed over the shopper is asked, once, how it went. A clean review is published; one with a
// link, a phone number or a rude word waits for a moderator; no answer in the window ends the run without a row.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { deliverNotification } from "@shopper/core/notifications";
import { deliveryOf } from "../../../support/payments/orders/reads";
import { fulfilWorld } from "../../../support/orders/fulfil";
import { staffWorld } from "../../../support/orders/staff";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
let s: Awaited<ReturnType<typeof staffWorld>>;
let cashier: string;
let moderator: string;
beforeAll(async () => {
  f = await fulfilWorld({
    acceptWithinMs: 60_000,
    pickLeadMs: 0,
    review: { askAfterMs: 300, waitMs: 4_000, moderateWithinMs: 6_000 },
  });
  s = await staffWorld(f.world.db, f.world.a.orgId, {
    orderFlows: f.flows,
    orderReviews: f.orderReviews,
    queue: f.world.queue,
  });
  cashier = await s.member("cashier");
  moderator = await s.member("admin");
}, 180_000);
afterAll(async () => {
  await f?.close();
});

/** An order taken all the way to the shopper's hands through the store's API. */
const handedOver = async () => {
  const order = await f.paid();
  await f.slotIn(order, 200, 120_000);
  await s.call(cashier, "POST", `/orders/${order.id}/accept`);
  const started = await s.call(cashier, "POST", `/orders/${order.id}/start`);
  for (const line of started.body.lines)
    await s.call(cashier, "PUT", `/orders/${order.id}/lines/${line.id}`, {
      pickedThousandths: line.quantityThousandths,
    });
  await s.call(cashier, "POST", `/orders/${order.id}/ready`);
  await s.call(cashier, "POST", `/orders/${order.id}/handover`);
  return order;
};
const review = (order: { id: string; key: string }, body: Record<string, unknown>) =>
  f.http.request(`/shop/${f.world.a.slug}/orders/${order.id}/review`, {
    body: { key: order.key, ...body },
  });
const reviewRow = async (order: { id: string }) =>
  (
    await f.world.db
      .select()
      .from(schema.orderReview)
      .where(eq(schema.orderReview.orderId, order.id))
  )[0];
const runOf = (order: { id: string }) => f.run({ id: `review-${order.id}` });
const asks = (order: { id: string }) =>
  f.world.sent.filter(
    (m) => m.type === "review.ask" && (m.payload as { orderId: string }).orderId === order.id,
  );
const publicReviews = async () =>
  (await (await f.http.request(`/shop/${f.world.a.slug}/reviews`)).json()) as {
    count: number;
    average: number | null;
    latest: { rating: number; comment: string | null; authorName: string }[];
  };

test("a handed-over order is asked about once, a clean review is published, and the shop shows it", async () => {
  const order = await handedOver();
  await expect.poll(() => asks(order).length, { timeout: 8_000 }).toBe(1);
  const sent = await review(order, { rating: 5, comment: "Quick and friendly service" });
  expect(sent.status).toBe(201);
  await expect
    .poll(async () => (await reviewRow(order))?.status, { timeout: 8_000 })
    .toBe("published");
  await expect.poll(async () => (await runOf(order))?.status).toBe("completed");
  const shown = await publicReviews();
  expect(shown.latest.map((r) => r.comment)).toContain("Quick and friendly service");
  expect(shown.latest.find((r) => r.comment === "Quick and friendly service")).toMatchObject({
    rating: 5,
    authorName: "Ama",
  });
  expect(asks(order)).toHaveLength(1);
});

test("a review with a link, a phone number or a blocked word waits for a moderator, who can publish or reject it", async () => {
  const before = (await publicReviews()).count;
  const flagged = [
    ["Better prices at www.cheap-shop.com", true],
    ["Call me on 0241234567 for a deal", true],
    ["Total scam", true],
  ] as const;
  const orders: { id: string; key: string }[] = [];
  for (const [comment] of flagged) {
    const order = await handedOver();
    await review(order, { rating: 2, comment });
    orders.push(order);
  }
  for (const order of orders)
    await expect
      .poll(async () => (await reviewRow(order))?.status, { timeout: 8_000 })
      .toBe("flagged");
  expect((await reviewRow(orders[0]!))?.flagReason).toMatch(/link/i);
  expect((await reviewRow(orders[1]!))?.flagReason).toMatch(/phone/i);
  expect((await publicReviews()).count).toBe(before);

  const queue = await s.call(moderator, "GET", "/reviews?status=flagged");
  const ids = queue.body.reviews.map((r: { orderId: string }) => r.orderId);
  expect(ids).toEqual(expect.arrayContaining(orders.map((o) => o.id)));
  const target = queue.body.reviews.find((r: { orderId: string }) => r.orderId === orders[0]!.id);
  expect(
    (await s.call(cashier, "POST", `/reviews/${target.id}/decision`, { decision: "approve" }))
      .status,
  ).toBe(403);
  expect(
    (await s.call(moderator, "POST", `/reviews/${target.id}/decision`, { decision: "approve" }))
      .status,
  ).toBe(200);
  expect((await reviewRow(orders[0]!))?.status).toBe("published");
  const rejected = queue.body.reviews.find((r: { orderId: string }) => r.orderId === orders[2]!.id);
  await s.call(moderator, "POST", `/reviews/${rejected.id}/decision`, { decision: "reject" });
  expect((await reviewRow(orders[2]!))?.status).toBe("rejected");
  expect(
    (await s.call(moderator, "POST", `/reviews/${rejected.id}/decision`, { decision: "approve" }))
      .status,
  ).toBe(409);
  await expect
    .poll(async () => (await runOf(orders[0]!))?.status, { timeout: 8_000 })
    .toBe("completed");
  expect((await publicReviews()).count).toBe(before + 1);
});

test("one review per order, only for a completed order, only with the shopper's key, and only one to five stars", async () => {
  const order = await handedOver();
  expect((await review(order, { rating: 4 })).status).toBe(201);
  expect((await review(order, { rating: 5 })).status).toBe(409);
  expect((await review(order, { rating: 6 })).status).toBe(400);
  const stranger = await f.http.request(`/shop/${f.world.a.slug}/orders/${order.id}/review`, {
    body: { key: crypto.randomUUID(), rating: 3 },
  });
  expect(stranger.status).toBe(404);
  const unfinished = await f.paid();
  expect((await review(unfinished, { rating: 5 })).status).toBe(409);
  expect(await reviewRow(unfinished)).toBeUndefined();
});

test("a shopper who never answers leaves no review and the run ends quietly", async () => {
  const order = await handedOver();
  await expect.poll(() => asks(order).length, { timeout: 8_000 }).toBe(1);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  expect(await reviewRow(order)).toBeUndefined();
  // The run is recorded as finished, not left waiting.
  expect(await runOf(order)).toMatchObject({ currentStep: "ended", status: "completed" });
});

test("the request to review is texted once however often the message is delivered", async () => {
  const order = await handedOver();
  await expect.poll(() => asks(order).length, { timeout: 8_000 }).toBe(1);
  const texts: string[] = [];
  const deps = {
    db: f.world.db,
    appVersion: "test",
    sms: { send: async (_to: string[], message: string) => void texts.push(message) } as never,
  };
  for (let i = 0; i < 2; i++) {
    const { delivery, answers } = deliveryOf(asks(order)[0]!);
    await deliverNotification(deps, delivery);
    expect(answers).toEqual({ ack: 1, retry: 0 });
  }
  expect(texts).toHaveLength(1);
  expect(texts[0]).toMatch(/how was order/i);
});

test("a shopper who reviews before they are asked is published and never asked", async () => {
  const order = await handedOver();
  expect((await review(order, { rating: 5, comment: "Lovely" })).status).toBe(201);
  await expect
    .poll(async () => (await reviewRow(order))?.status, { timeout: 8_000 })
    .toBe("published");
  expect(asks(order)).toHaveLength(0);
});
