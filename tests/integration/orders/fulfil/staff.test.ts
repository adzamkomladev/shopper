// Day 34: the store's queue and every step of filling an order, over the API, with real sessions. order.read sees the
// queue; order.fulfil changes it; a branch-scoped member reaches only their branches; another shop's order is not there.
import { v7 } from "uuid";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fulfilWorld } from "../../../support/orders/fulfil";
import { staffWorld } from "../../../support/orders/staff";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
let s: Awaited<ReturnType<typeof staffWorld>>;
let cashier: string;
let accountant: string;
let inventory: string;
let otherBranchOnly: string;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 60_000, pickLeadMs: 0 });
  s = await staffWorld(f.world.db, f.world.a.orgId, { orderFlows: f.flows, queue: f.world.queue });
  cashier = await s.member("cashier");
  accountant = await s.member("accountant");
  inventory = await s.member("inventory");
  otherBranchOnly = await s.member("cashier", [f.shop.branches[1]]);
}, 180_000);
afterAll(async () => {
  await f?.close();
});

test("the queue counts orders per stage, lists a stage soonest slot first, and refuses people without order.read", async () => {
  const first = await f.paid();
  const second = await f.paid();
  await f.slotIn(first, 3_600_000, 3_600_000);
  await f.slotIn(second, 1_800_000, 3_600_000);
  const { body } = await s.call(cashier, "GET", "/orders?stage=new");
  expect(body.counts.new).toBeGreaterThanOrEqual(2);
  const ours = body.orders.filter((o: { id: string }) => [first.id, second.id].includes(o.id));
  expect(ours.map((o: { id: string }) => o.id)).toEqual([second.id, first.id]);
  expect(ours[0]).toMatchObject({
    status: "paid",
    fulfilment: "pickup",
    customerName: "Ama Mensah",
    items: 2,
  });
  expect((await s.call(accountant, "GET", "/orders")).status).toBe(200);
  expect((await s.call(inventory, "GET", "/orders")).status).toBe(403);
  expect((await s.call(null, "GET", "/orders")).status).toBe(401);
  expect((await s.call(cashier, "GET", "/orders?stage=bogus")).status).toBe(400);
});

test("reading is not changing: order.read cannot accept, pick or cancel", async () => {
  const order = await f.paid();
  for (const path of ["accept", "decline", "start", "ready", "dispatch", "handover", "cancel"])
    expect((await s.call(accountant, "POST", `/orders/${order.id}/${path}`)).status).toBe(403);
  expect((await s.call(accountant, "PUT", `/orders/${order.id}/lines/${v7()}`, {})).status).toBe(
    403,
  );
  expect((await f.row(order)).status).toBe("paid");
});

test("a member limited to one branch sees only that branch's orders, and another branch's order is not found", async () => {
  const here = await f.paid();
  const there = await f.paid({ branch: f.shop.branches[1] });
  const scoped = await s.call(otherBranchOnly, "GET", "/orders?stage=new");
  const seen = scoped.body.orders.map((o: { id: string }) => o.id);
  expect(seen).toContain(there.id);
  expect(seen).not.toContain(here.id);
  expect(scoped.body.counts.new).toBe(seen.length);
  expect((await s.call(otherBranchOnly, "GET", `/orders/${here.id}`)).status).toBe(404);
  expect((await s.call(otherBranchOnly, "POST", `/orders/${here.id}/accept`)).status).toBe(404);
  expect(
    (await s.call(otherBranchOnly, "GET", `/orders?branchId=${f.shop.branches[0]}`)).status,
  ).toBe(403);
  expect((await f.row(here)).status).toBe("paid");
});

test("an order id from nowhere, or from another shop, is not found", async () => {
  expect((await s.call(cashier, "GET", `/orders/${v7()}`)).status).toBe(404);
  expect((await s.call(cashier, "GET", "/orders/not-an-id")).status).toBe(400);
});

test("filling an order over the API: accept, start, scan lines, finish, hand over — and each step refuses a repeat", async () => {
  const order = await f.paid();
  await f.slotIn(order, 200, 120_000);
  expect((await s.call(cashier, "POST", `/orders/${order.id}/accept`)).body.status).toBe(
    "accepted",
  );
  expect((await s.call(cashier, "POST", `/orders/${order.id}/accept`)).status).toBe(409);
  const started = await s.call(cashier, "POST", `/orders/${order.id}/start`);
  expect(started.body.status).toBe("picking");
  const [oil, rice] = started.body.lines;
  expect(oil).toMatchObject({ name: "Frytol oil 1L", quantityThousandths: 2_000 });
  expect(oil.pick).toBeUndefined();
  expect((await s.call(cashier, "POST", `/orders/${order.id}/ready`)).status).toBe(409);
  const one = await s.call(cashier, "PUT", `/orders/${order.id}/lines/${oil.id}`, {
    pickedThousandths: 2_000,
  });
  expect(one.status).toBe(200);
  const two = await s.call(cashier, "PUT", `/orders/${order.id}/lines/${rice.id}`, {
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.basmati, quantityThousandths: 500 },
  });
  expect(two.body.lines[1].pick).toMatchObject({
    outcome: "substituted",
    pickedThousandths: 1_000,
    substitute: { name: "Basmati rice", quantityThousandths: 500 },
  });
  const ready = await s.call(cashier, "POST", `/orders/${order.id}/ready`);
  expect(ready.body.status).toBe("ready");
  // 0.5 kg basmati at 40.00 a kg is 20.00, more than the 9.25 it replaces, so the shopper pays 9.25.
  expect(ready.body.adjustment).toMatchObject({
    beforeGross: 877_500,
    afterGross: 877_500,
    refundAmount: 0,
  });
  expect((await s.call(cashier, "POST", `/orders/${order.id}/dispatch`)).status).toBe(409);
  const done = await s.call(cashier, "POST", `/orders/${order.id}/handover`);
  expect(done.body.status).toBe("completed");
  expect(done.body.events.map((e: { status: string }) => e.status)).toEqual(
    expect.arrayContaining(["paid", "accepted", "picking", "ready", "completed"]),
  );
  expect((await s.call(cashier, "POST", `/orders/${order.id}/handover`)).status).toBe(409);
  const finished = await s.call(cashier, "GET", "/orders?stage=done");
  expect(finished.body.orders.map((o: { id: string }) => o.id)).toContain(order.id);
});

test("declining and cancelling over the API refund the shopper", async () => {
  const declined = await f.paid();
  expect((await s.call(cashier, "POST", `/orders/${declined.id}/decline`)).body.status).toBe(
    "refunded",
  );
  const cancelled = await f.paid();
  await s.call(cashier, "POST", `/orders/${cancelled.id}/accept`);
  expect((await s.call(cashier, "POST", `/orders/${cancelled.id}/cancel`)).body.status).toBe(
    "refunded",
  );
  expect((await f.refunds(declined))[0]!.reason).toBe("declined");
  expect((await f.refunds(cancelled))[0]!.reason).toBe("cancelled");
});

test("the detail carries what a picker needs: the customer, barcodes a scanner reads, and the line prices", async () => {
  await f.world.db.insert((await import("@shopper/db-pg")).productBarcode).values({
    orgId: f.world.a.orgId,
    productId: f.products.oil,
    code: "6001234567890",
  });
  const order = await f.paid();
  const { body } = await s.call(cashier, "GET", `/orders/${order.id}`);
  expect(body.customer).toMatchObject({ name: "Ama Mensah", phone: "0241234567" });
  expect(body.lines[0].barcodes).toEqual(["6001234567890"]);
  expect(body.lines[0].gross).toBe(600_000);
  expect(body.branch.name).toBe("Osu");
});

test("the shared runtime serves the staff routes: signed out they are refused, never missing", async () => {
  for (const path of ["/orders", `/orders/${v7()}`, "/reviews"]) {
    const reply = await f.http.request(path, {
      origin: null,
      headers: { "X-Shopper-Org": f.world.a.orgId },
    });
    expect(reply.status, path).toBe(401);
  }
});
