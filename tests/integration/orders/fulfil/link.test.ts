// Day 35: the text that asks a shopper for a review carries a signed link to their order page. The link opens the order
// and takes one review without the checkout key the browser kept; a changed, borrowed or expired link opens nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { deliverNotification } from "@shopper/core/notifications";
import {
  finishStoreOrder,
  handOverStoreOrder,
  recordPick,
  signReviewToken,
} from "@shopper/core/orders";
import { deliveryOf } from "../../../support/payments/orders/reads";
import { fulfilWorld } from "../../../support/orders/fulfil";
import { pickHelpers } from "../../../support/orders/pick";
import { linkSecret } from "../../../support/shop/world";

const SHOP_URL = "https://shop.example.test";
let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 60_000, pickLeadMs: 0 });
}, 180_000);
afterAll(async () => {
  await f?.close();
});

/** An order picked in full and handed over, through the store's commands. */
const handedOver = async () => {
  const { order, oil, rice } = await pickHelpers(f).accepted();
  for (const line of [oil, rice])
    await recordPick(f.world.db, f.ctx, {
      id: order.id,
      lineId: line.id,
      pickedThousandths: line.quantityThousandths,
    });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await handOverStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  return order;
};
/** Delivers the request to review and answers the one text it sent. */
const ask = async (order: { id: string }, shopUrl?: string) => {
  const texts: string[] = [];
  const { delivery, answers } = deliveryOf({
    id: v7(),
    orgId: f.world.a.orgId,
    v: 1,
    sequence: "0",
    type: "review.ask",
    payload: { orderId: order.id },
  } as never);
  await deliverNotification(
    {
      db: f.world.db,
      appVersion: "test",
      linkSecret,
      shopUrl,
      sms: { send: async (_to: string[], message: string) => void texts.push(message) } as never,
    },
    delivery,
  );
  expect(answers).toEqual({ ack: 1, retry: 0 });
  return texts[0]!;
};
const path = (id: string) => `/shop/${f.world.a.slug}/orders/${id}`;
const open = (id: string, token: string) =>
  f.http.request(`${path(id)}?r=${encodeURIComponent(token)}`);
const review = (id: string, token: string, rating = 5) =>
  f.http.request(`${path(id)}/review`, { body: { r: token, rating } });

test("the text links to the order page, which opens and takes one review with the link alone", async () => {
  const order = await handedOver();
  const text = await ask(order, SHOP_URL);
  const link = text.match(/https:\/\/\S+/)![0];
  expect(link.startsWith(`${SHOP_URL}/${f.world.a.slug}/orders/${order.id}?r=`)).toBe(true);
  const token = new URL(link).searchParams.get("r")!;

  const opened = await open(order.id, token);
  expect(opened.status).toBe(200);
  expect(await opened.json()).toMatchObject({ id: order.id, canReview: true });
  expect((await review(order.id, token)).status).toBe(201);
  expect((await review(order.id, token)).status).toBe(409);
});

test("a changed link, another order's link and an expired link open nothing", async () => {
  const first = await handedOver();
  const second = await handedOver();
  const token = new URL((await ask(first, SHOP_URL)).match(/https:\/\/\S+/)![0]).searchParams.get(
    "r",
  )!;
  const changed = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
  expect((await open(first.id, changed)).status).toBe(404);
  expect((await open(second.id, token)).status).toBe(404);
  expect((await review(second.id, token)).status).toBe(404);
  const expired = await signReviewToken(linkSecret, {
    orgId: f.world.a.orgId,
    orderId: first.id,
    exp: Date.now() - 1_000,
  });
  expect((await open(first.id, expired)).status).toBe(404);
  expect((await review(first.id, expired)).status).toBe(404);
});

test("without a shop address the text still asks, with no link", async () => {
  const order = await handedOver();
  const text = await ask(order);
  expect(text).toMatch(/how was order/i);
  expect(text).not.toMatch(/https?:\/\//);
});
