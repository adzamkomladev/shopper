// Day 33: Hubtel as the second provider behind the same steps. The shopper approves on their phone; only Hubtel's
// status API is believed, whatever the callback claims; Hubtel money cannot be refunded automatically.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { refundOrderPayment, refundPaidOrder } from "@shopper/core/orders";
import { orderPayWorld } from "../../../support/payments/orders/world";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld();
  await w.world.db
    .update(schema.org)
    .set({ momoProvider: "hubtel" })
    .where(eq(schema.org.id, w.world.a.orgId));
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const prompt = { method: "momo", network: "mtn", phone: "0241234567" };
const charged = (reference: string) =>
  w.hubtelFake.requests.find(
    (request) =>
      (request.body as { ClientReference?: string } | undefined)?.ClientReference === reference,
  );

test("Hubtel is prompted for the order's total and the order is paid only when its status API says so", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, prompt)).body.payment.id as string;
  await expect.poll(() => charged(reference)).toBeDefined();
  expect(charged(reference)!.body).toMatchObject({
    Channel: "mtn-gh",
    CustomerMsisdn: "233241234567",
  });
  expect((await w.payments(order))[0]).toMatchObject({ provider: "hubtel", status: "pending" });

  // A callback that claims success while Hubtel still says unpaid changes nothing.
  expect((await w.hubtelCallback(reference, true)).status).toBe(200);
  expect((await w.row(order)).status).toBe("placed");

  w.hubtelFake.settle(reference, "Paid");
  expect((await w.hubtelCallback(reference, true)).status).toBe(200);
  expect((await w.row(order)).status).toBe("paid");
  expect(await w.fiscal(order)).toHaveLength(1);
  const entry = (await w.journal("order", order.id))!;
  expect(entry.lines.momo_clearing).toBe((await w.row(order)).gross);
  // The same callback again is a replay.
  await w.hubtelCallback(reference, true);
  expect(await w.fiscal(order)).toHaveLength(1);
});

test("Hubtel collecting a different amount never pays the order", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, prompt)).body.payment.id as string;
  await expect.poll(() => charged(reference)).toBeDefined();
  w.hubtelFake.settle(reference, "Paid", 1);
  expect((await w.hubtelCallback(reference, true)).status).toBe(400);
  expect((await w.row(order)).status).toBe("placed");
});

test("a payer who declines on their phone fails the attempt and keeps the order open", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, prompt)).body.payment.id as string;
  await expect.poll(() => charged(reference)).toBeDefined();
  w.hubtelFake.settle(reference, "Failed");
  await w.hubtelCallback(reference, false);
  expect((await w.payments(order))[0]!.status).toBe("failed");
  expect((await w.row(order)).status).toBe("placed");
});

test("a Hubtel refund waits as refund_due for the store: no automatic payout is attempted", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, prompt)).body.payment.id as string;
  await expect.poll(() => charged(reference)).toBeDefined();
  w.hubtelFake.settle(reference, "Paid");
  await w.hubtelCallback(reference, true);
  const context = { orgId: w.world.a.orgId, appVersion: "test" };
  const out = await refundPaidOrder(w.world.db, context, { id: order.id, reason: "cancelled" });
  expect(out.refunded).toBe(true);
  await refundOrderPayment({ ...w.deps, paystack: w.paystack }, out.id!, w.world.a.orgId);
  expect((await w.refunds(order))[0]).toMatchObject({ status: "refund_due" });
  expect(w.fake.requests.filter((request) => request.path === "/refund")).toHaveLength(0);
});
