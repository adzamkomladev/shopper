// Day 34: after the store accepts, the order's workflow sleeps until the pick hour, tells the pickers, waits for the pick
// to finish and then for the shopper to collect. Missing either deadline refunds the order and puts the goods back.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { acceptStoreOrder, cancelStoreOrder } from "@shopper/core/orders";
import { fulfilWorld } from "../../../support/orders/fulfil";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  // Pickers hear of an order when its slot opens; a picked order may wait 2.5 s past its slot for the shopper.
  f = await fulfilWorld({ acceptWithinMs: 20_000, pickLeadMs: 0, collectWithinMs: 2_500 });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

const set = (order: { id: string }, status: (typeof schema.orderStatuses)[number]) =>
  f.world.db.update(schema.onlineOrder).set({ status }).where(eq(schema.onlineOrder.id, order.id));
const net = async (order: { id: string }) =>
  (await f.movements(order)).reduce((total, row) => total + row.quantityThousandths, 0);
const queued = (order: { id: string }, type: string) =>
  f.world.sent.filter(
    (message) =>
      message.type === type && (message.payload as { orderId?: string }).orderId === order.id,
  );
const audits = async (order: { id: string }) =>
  (await f.world.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, order.id)))
    .sort((a, b) => Number(a.chainSeq) - Number(b.chainSeq))
    .map((row) => row.command);

test("an accepted order waits for its pick hour, then tells the pickers once and waits for the pick", async () => {
  const order = await f.paid();
  await f.slotIn(order, 1_500, 20_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await expect.poll(async () => (await f.run(order))?.currentStep).toBe("accepted");
  expect(queued(order, "order.pick_due")).toHaveLength(0);
  await expect
    .poll(async () => (await f.run(order))?.currentStep, { timeout: 10_000 })
    .toBe("pick_due");
  expect(queued(order, "order.pick_due")).toHaveLength(1);

  // The pick is finished and the order is handed over: the run follows the order to its end.
  await set(order, "ready");
  await f.flows.send(order.id, "picked", {});
  await expect.poll(async () => (await f.run(order))?.currentStep).toBe("picked");
  await set(order, "completed");
  await f.flows.send(order.id, "handed_over", {});
  await expect.poll(async () => (await f.run(order))?.status).toBe("completed");
  expect((await f.run(order))?.currentStep).toBe("completed");
  expect(await audits(order)).toEqual(
    expect.arrayContaining(["order.accepted", "order.pick_due", "order.picked", "order.completed"]),
  );
  expect(queued(order, "order.pick_due")).toHaveLength(1);
});

test("an order nobody picks by the end of its slot is refunded in full and its goods go back", async () => {
  const order = await f.paid();
  await f.slotIn(order, 300, 1_200);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await expect.poll(async () => (await f.row(order)).status, { timeout: 15_000 }).toBe("refunded");
  expect(await f.refunds(order)).toMatchObject([{ reason: "not_fulfilled", amount: order.gross }]);
  expect(await net(order)).toBe(0);
  await expect.poll(() => f.refundCalls().length, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("a picked order nobody collects is refunded in full and restocked", async () => {
  const order = await f.paid();
  await f.slotIn(order, 300, 1_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await expect
    .poll(async () => (await f.run(order))?.currentStep, { timeout: 10_000 })
    .toBe("pick_due");
  await set(order, "ready");
  await f.flows.send(order.id, "picked", {});
  await expect.poll(async () => (await f.row(order)).status, { timeout: 15_000 }).toBe("refunded");
  expect(await f.refunds(order)).toMatchObject([{ reason: "uncollected", amount: order.gross }]);
  expect(await net(order)).toBe(0);
});

test("an order the store cancels while it waits for its pick hour ends there, without telling the pickers", async () => {
  const order = await f.paid();
  await f.slotIn(order, 1_200, 20_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await expect
    .poll(async () => (await f.run(order))?.currentStep, { timeout: 10_000 })
    .toBe("pick_due");
  expect(queued(order, "order.pick_due")).toHaveLength(0);
  expect((await f.row(order)).status).toBe("refunded");
  expect(await f.refunds(order)).toHaveLength(1);
});
