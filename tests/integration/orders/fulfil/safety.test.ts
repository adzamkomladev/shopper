// Day 34 review follow-ups: what finishing a pick must get right when the numbers are awkward: weighed fractions of a
// pesewa, a substitute with one unit left, a cost that moved since the sale, two refunds open on one payment.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import {
  acceptStoreOrder,
  cancelStoreOrder,
  finishStoreOrder,
  recordPick,
  startPicking,
} from "@shopper/core/orders";
import { fulfilWorld } from "../../../support/orders/fulfil";
import { pickHelpers } from "../../../support/orders/pick";
import { staffWorld } from "../../../support/orders/staff";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
let accepted: ReturnType<typeof pickHelpers>["accepted"];
let net: ReturnType<typeof pickHelpers>["net"];
let books: ReturnType<typeof pickHelpers>["books"];
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
  // A person to receive stock as: the shop's owner signs up.
  await staffWorld(f.world.db, f.world.a.orgId, {});
  ({ accepted, net, books } = pickHelpers(f));
}, 120_000);
afterAll(async () => {
  await f?.close();
});

test("a weighed item short by a fraction of a pesewa is credited in whole pesewas and the refund goes through", async () => {
  const { order, oil, rice } = await accepted();
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 2_000 });
  // 0.999 kg found of 1.5 kg: 0.501 kg is 92 685 of the shop's money units, which is not a whole pesewa.
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 999 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const adjustment = (await f.adjustment(order))!;
  expect(adjustment.refundAmount % 100).toBe(0);
  expect(adjustment.refundAmount).toBe(92_700);
  expect(adjustment.afterGross + adjustment.refundAmount).toBe(adjustment.beforeGross);
  expect(await f.refunds(order)).toMatchObject([{ reason: "short_pick", amount: 92_700 }]);
  const { extra } = await books(order);
  expect(Object.values(extra!.lines).reduce((a, b) => a + b, 0)).toBe(0);
});

test("two items cannot both be replaced by the one unit the branch has: finishing is refused and nothing changes", async () => {
  const { order, oil, rice } = await accepted();
  const single = { productId: f.substitutes.single, quantityThousandths: 1_000 };
  // Each pick alone is fine: one unit is on the shelf.
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: oil.id,
    pickedThousandths: 1_000,
    substitute: single,
  });
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: rice.id,
    pickedThousandths: 1_000,
    substitute: single,
  });
  await expect(finishStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "stock",
  });
  expect((await f.row(order)).status).toBe("picking");
  expect(await f.adjustment(order)).toBeUndefined();
  expect(await f.refunds(order)).toHaveLength(0);
  expect((await net(order)).get(f.substitutes.single)).toBeUndefined();
});

test("returned goods reverse the cost the sale booked, not today's dearer cost", async () => {
  const stamp = Date.now();
  // Oil cost GHS 10.00 when the order was paid; a dearer GHS 20.00 receipt came in before the pick.
  await f.receive(f.products.oil, 100_000, new Date(stamp - 120_000));
  const order = await f.paid();
  await f.receive(f.products.oil, 200_000, new Date(Date.now() + 1_000));
  await f.slotIn(order, 300, 120_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const [oil, rice] = await f.lines(order);
  await startPicking(f.world.db, f.ctx, { id: order.id });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil!.id, pickedThousandths: 1_000 });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice!.id, pickedThousandths: 1_500 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const original = (await f.journal("order", order.id))!;
  const { extra } = await books(order);
  // One oil came back: the cost of goods the sale booked for it (GHS 10.00) is given back, no more.
  expect(original.lines.cogs).toBe(200_000);
  expect(extra!.lines.cogs).toBe(-100_000);
  expect(extra!.lines.inventory).toBe(100_000);
});

test("with a short-pick refund and a cancel refund both open, a refund webhook settles only the refund it names", async () => {
  const { order, oil, rice } = await accepted();
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 1_000 });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_500 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await f.sendRefunds();
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await f.sendRefunds();
  const refunds = await f.refunds(order);
  expect(refunds.map((refund) => refund.status)).toEqual(["requested", "requested"]);
  const [first, second] = [
    refunds.find((r) => r.reason === "short_pick")!,
    refunds.find((r) => r.reason === "cancelled")!,
  ];
  const hook = f.fake.refundWebhook(second.providerReference!, "refund.processed");
  await f.http.request("/webhooks/paystack", {
    raw: hook.body,
    origin: null,
    headers: { "x-paystack-signature": hook.signature },
  });
  const after = await f.refunds(order);
  expect(after.find((r) => r.id === second.id)!.status).toBe("processed");
  expect(after.find((r) => r.id === first.id)!.status).toBe("requested");
});
