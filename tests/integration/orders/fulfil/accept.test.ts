// Day 34: the store has ten minutes to take a paid order on. It can decline (refunded at once), cancel it later (refunded
// once, goods back), and a shopper can cancel an order they have not paid for (the reservation is released at once).
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import {
  ACCEPT_WITHIN_MS,
  acceptStoreOrder,
  cancelOwnOrder,
  cancelStoreOrder,
  declineStoreOrder,
} from "@shopper/core/orders";
import { fulfilWorld } from "../../../support/orders/fulfil";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 20_000 });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

const net = async (order: { id: string }) =>
  (await f.movements(order)).reduce((total, row) => total + row.quantityThousandths, 0);

test("the store has ten minutes to accept a paid order", () => {
  expect(ACCEPT_WITHIN_MS).toBe(600_000);
});

test("accepting moves the order on once, stamps the time, and leaves a timeline", async () => {
  const order = await f.paid();
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const row = await f.row(order);
  expect(row.status).toBe("accepted");
  expect(row.acceptedAt).not.toBeNull();
  expect(await f.events(order)).toEqual(expect.arrayContaining(["placed", "paid", "accepted"]));
  await expect(acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  await expect.poll(async () => (await f.run(order))?.currentStep).toBe("accepted");
});

test("declining refunds the whole payment at once, puts the goods back and ends the run", async () => {
  const order = await f.paid();
  await declineStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect((await f.row(order)).status).toBe("refunded");
  const [refund] = await f.refunds(order);
  expect(refund).toMatchObject({ reason: "declined", amount: order.gross });
  expect(await net(order)).toBe(0);
  await f.sendRefunds();
  expect(f.refundCalls().length).toBeGreaterThan(0);
  // Deciding twice is refused and refunds nothing more.
  await expect(declineStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  expect(await f.refunds(order)).toHaveLength(1);
  await expect.poll(async () => (await f.run(order))?.currentStep).toBe("paid");
  expect((await f.row(order)).status).toBe("refunded");
});

test("the store cancels an accepted order: one full refund, the goods back, the books and invoice reversed", async () => {
  const order = await f.paid();
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const before = f.refundCalls().length;
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect((await f.row(order)).status).toBe("refunded");
  const [refund] = await f.refunds(order);
  expect(refund).toMatchObject({ reason: "cancelled", amount: order.gross });
  expect(await net(order)).toBe(0);
  expect(await f.journal("reversal", refund!.id)).toBeDefined();
  await f.sendRefunds();
  await f.sendRefunds();
  expect(f.refundCalls().length - before).toBe(1);
  await expect(cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  expect(await f.refunds(order)).toHaveLength(1);
});

test("a shopper cancelling an unpaid order releases its reservation at once and it cannot be paid", async () => {
  const order = await f.placeLapsing(1_500);
  expect((await f.holds(order))[0]!.releasedAt).toBeNull();
  await cancelOwnOrder(f.world.db, f.ctx, order.id);
  expect((await f.row(order)).status).toBe("cancelled");
  expect((await f.holds(order)).map((hold) => hold.releaseReason)).toEqual([
    "cancelled",
    "cancelled",
  ]);
  expect((await f.pay(order)).status).toBe(409);
  await expect(cancelOwnOrder(f.world.db, f.ctx, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  // The run ends when the hold would have: it finds the order cancelled, not expired.
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  expect((await f.row(order)).status).toBe("cancelled");
});
