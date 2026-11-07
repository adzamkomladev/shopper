// Day 33: payments that do not keep an order. A failed attempt keeps the stock and can be retried; with no payment
// the order expires and its stock comes back; money that arrives after the order is gone, or twice, is refunded once.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { deliverNotification } from "@shopper/core/notifications";
import { refundOrderPayment } from "@shopper/core/orders";
import { orderPayWorld } from "../../../support/payments/orders/world";
import { deliveryOf } from "../../../support/payments/orders/reads";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld();
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const expired = (order: { id: string }) => async () => (await w.row(order)).status;

test("a declined mobile money attempt fails but keeps the stock, and the shopper can try again", async () => {
  const order = await w.place();
  const declined = await w.pay(order, { method: "momo", network: "mtn", phone: "0551230000" });
  expect(declined.status).toBe(202);
  await expect.poll(async () => (await w.payments(order))[0]!.status).toBe("failed");
  expect((await w.payments(order))[0]!.failureReason).toMatch(/declined/i);
  expect((await w.row(order)).status).toBe("placed");
  expect((await w.holds(order)).every((hold) => hold.releasedAt === null)).toBe(true);
  expect((await w.view(order)).payment).toMatchObject({ status: "failed" });
  // A second attempt is allowed while the hold lasts.
  const retry = await w.pay(order, { method: "card" });
  expect(retry.status).toBe(202);
  expect(retry.body.payment.id).not.toBe(declined.body.payment.id);
});

test("no payment before the hold ends: the order expires and its reservation is released", async () => {
  const order = await w.placeLapsing(2_500);
  const attempt = await w.pay(order, { method: "card" });
  expect(attempt.status).toBe(202);
  await expect.poll(expired(order), { timeout: 20_000 }).toBe("expired");
  expect((await w.holds(order)).every((hold) => hold.releaseReason === "expired")).toBe(true);
  await expect.poll(async () => (await w.payments(order))[0]!.status).toBe("expired");
  // Nothing was invoiced or posted, and the order can no longer be paid.
  expect(await w.fiscal(order)).toHaveLength(0);
  expect(await w.journal("order", order.id)).toBeUndefined();
  expect((await w.pay(order)).status).toBe(409);
});

test("money that arrives after the order lapsed is refunded once, never kept as an order", async () => {
  const order = await w.placeLapsing(2_500);
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  await expect.poll(expired(order), { timeout: 20_000 }).toBe("expired");
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  const before = w.world.sent.length;
  expect((await w.paystackEvent(reference, w.pesewas(order.gross))).status).toBe(200);
  expect((await w.row(order)).status).toBe("expired");
  expect(await w.fiscal(order)).toHaveLength(0);
  expect(await w.movements(order)).toHaveLength(0);
  const [refund] = await w.refunds(order);
  expect(refund).toMatchObject({ reason: "late_payment", status: "pending", amount: order.gross });
  const queued = w.world.sent.slice(before).filter((envelope) => envelope.type === "order.refund");
  expect(queued).toHaveLength(1);

  // The queue consumer sends the refund; delivering it twice still refunds once.
  const consumer = {
    db: w.world.db,
    appVersion: "test",
    orderRefunds: { ...w.deps, paystack: w.paystack },
  };
  for (let i = 0; i < 2; i++) {
    const { delivery, answers } = deliveryOf(queued[0]!);
    await deliverNotification(consumer, delivery);
    expect(answers).toEqual({ ack: 1, retry: 0 });
  }
  expect(w.fake.requests.filter((request) => request.path === "/refund")).toHaveLength(1);
  const [sent] = await w.refunds(order);
  expect(sent!.providerReference).not.toBeNull();

  // Paystack's refund.processed webhook settles it, once.
  const hook = w.fake.refundWebhook(sent!.providerReference!, "refund.processed");
  for (let i = 0; i < 2; i++)
    expect(
      (
        await w.http.request("/webhooks/paystack", {
          raw: hook.body,
          origin: null,
          headers: { "x-paystack-signature": hook.signature },
        })
      ).status,
    ).toBe(200);
  expect((await w.refunds(order))[0]!.status).toBe("processed");
});

test("two attempts that both pay keep one order and refund the second payment", async () => {
  const order = await w.place();
  const first = (await w.pay(order, { method: "card" })).body.payment.id as string;
  w.fake.behave("0551234955", "pending");
  const second = (await w.pay(order, { method: "momo", network: "mtn", phone: "0551234955" })).body
    .payment.id as string;
  expect(second).not.toBe(first);
  expect((await w.payments(order)).find((attempt) => attempt.id === first)!.status).toBe("expired");
  for (const reference of [second, first]) {
    w.fake.knownCharge(reference, w.pesewas(order.gross));
    await w.paystackEvent(reference, w.pesewas(order.gross));
  }
  expect((await w.row(order)).status).toBe("paid");
  expect(await w.fiscal(order)).toHaveLength(1);
  const refunds = await w.refunds(order);
  expect(refunds).toHaveLength(1);
  expect(refunds[0]).toMatchObject({ reason: "duplicate_payment", orderPaymentId: first });
});

test("payment landing after the stock timer freed the hold, before the order expired, is refunded not sold", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  // The StockHold alarm can fire a moment before the order's own workflow does.
  await w.world.db
    .update(schema.stockHold)
    .set({ releasedAt: new Date(), releaseReason: "expired" })
    .where(eq(schema.stockHold.orderId, order.id));
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  expect((await w.row(order)).status).toBe("placed");
  expect(await w.movements(order)).toHaveLength(0);
  expect((await w.refunds(order))[0]).toMatchObject({ reason: "late_payment" });
});

test("a payment landing after the hold's deadline is refunded even if no timer has freed the stock yet", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  await w.world.db
    .update(schema.stockHold)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.stockHold.orderId, order.id));
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  expect((await w.row(order)).status).toBe("placed");
  expect(await w.fiscal(order)).toHaveLength(0);
  expect((await w.refunds(order))[0]).toMatchObject({ reason: "late_payment" });
});

test("a provider outage on the prompt fails the attempt at once so the shopper can try again", async () => {
  w.fake.behave("0551234984", "error");
  const order = await w.place();
  const first = await w.pay(order, { method: "momo", network: "mtn", phone: "0551234984" });
  await expect.poll(async () => (await w.payments(order))[0]!.status).toBe("failed");
  expect((await w.payments(order))[0]!.failureReason).toMatch(/could not reach/i);
  const again = await w.pay(order, { method: "card" });
  expect(again.status).toBe(202);
  expect(again.body.payment.id).not.toBe(first.body.payment.id);
});

test("two consumers sending the same owed refund ask Paystack once", async () => {
  const order = await w.placeLapsing(2_500);
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  await expect.poll(expired(order), { timeout: 20_000 }).toBe("expired");
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  const [refund] = await w.refunds(order);
  const before = w.fake.requests.filter((request) => request.path === "/refund").length;
  await Promise.all([
    refundOrderPayment({ ...w.deps, paystack: w.paystack }, refund!.id, w.world.a.orgId),
    refundOrderPayment({ ...w.deps, paystack: w.paystack }, refund!.id, w.world.a.orgId),
  ]);
  expect(w.fake.requests.filter((request) => request.path === "/refund").length - before).toBe(1);
  expect((await w.refunds(order))[0]!.status).toBe("requested");
});
