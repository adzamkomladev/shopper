// Day 35: a mobile money network that asks for a one-time code (Paystack's send_otp) no longer fails the attempt. The
// order page asks the shopper for the code; a wrong one keeps the attempt open with the reason, the right one pays the
// order, and the hold's deadline still ends an attempt nobody finishes.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { FAKE_OTP } from "../../../../tooling/paystack/server";
import { orderPayWorld } from "../../../support/payments/orders/world";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld();
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const prompt = (phone: string) => ({ method: "momo", network: "telecel", phone });
const code = (order: { id: string; key: string }, otp: string, key = order.key) =>
  w.http.request(`/shop/${w.world.a.slug}/orders/${order.id}/pay/code`, { body: { key, otp } });
const attempt = async (order: { id: string }) => (await w.payments(order))[0]!;

test("the attempt waits for the code: a wrong code keeps it open with the reason, the right one pays", async () => {
  w.fake.behave("0551234986", "send_otp");
  const order = await w.place();
  expect((await w.pay(order, prompt("0551234986"))).status).toBe(202);
  await expect.poll(async () => (await attempt(order)).status).toBe("otp");
  const view = await (
    await w.http.request(`/shop/${w.world.a.slug}/orders/${order.id}?t=${order.key}`)
  ).json();
  expect(view.payment).toMatchObject({ status: "otp", method: "momo" });

  expect((await code(order, "000000")).status).toBe(202);
  await expect.poll(async () => (await attempt(order)).failureReason).toMatch(/incorrect/i);
  expect((await attempt(order)).status).toBe("otp");

  expect((await code(order, FAKE_OTP)).status).toBe(202);
  await expect.poll(async () => (await w.row(order)).status).toBe("paid");
  expect((await attempt(order)).status).toBe("confirmed");
  expect(w.fake.requests.filter((request) => request.path === "/charge/submit_otp")).toHaveLength(
    2,
  );
});

test("a code needs the order's key and an attempt waiting for one", async () => {
  w.fake.behave("0551234988", "success");
  const paid = await w.place();
  await w.pay(paid, prompt("0551234988"));
  await expect.poll(async () => (await w.row(paid)).status).toBe("paid");
  expect((await code(paid, FAKE_OTP)).status).toBe(409);

  w.fake.behave("0551234989", "send_otp");
  const waiting = await w.place();
  await w.pay(waiting, prompt("0551234989"));
  await expect.poll(async () => (await attempt(waiting)).status).toBe("otp");
  expect((await code(waiting, FAKE_OTP, crypto.randomUUID())).status).toBe(404);
  expect((await code(waiting, "12")).status).toBe(400);
});

test("a code never given: the hold's deadline ends the attempt and the order expires", async () => {
  w.fake.behave("0551234990", "send_otp");
  const order = await w.placeLapsing(3_000);
  await w.pay(order, prompt("0551234990"));
  await expect.poll(async () => (await attempt(order)).status).toBe("otp");
  await expect.poll(async () => (await w.row(order)).status, { timeout: 20_000 }).toBe("expired");
  expect(["expired", "failed"]).toContain((await attempt(order)).status);
});
