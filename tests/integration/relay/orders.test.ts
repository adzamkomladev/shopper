// v1.5 Day 50: the box's order inbox. Each Publisher run pulls the relay's paid orders, decides them against the box's
// real stock (holding it on accept), publishes, then tells the relay what happened to each order; the relay refunds
// what the box turned down and moves the order's workflow on. The box honours the price the customer paid.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { deliverNotification } from "@shopper/core/notifications";
import {
  cancelStoreOrder,
  finishStoreOrder,
  handOverStoreOrder,
  listOrderQueue,
  readStaffOrder,
  recordPick,
  refundPaidOrder,
  startPicking,
} from "@shopper/core/orders";
import { applyRelayEvents } from "@shopper/core/relay";
import { deliveryOf } from "../../support/payments/orders/reads";
import { inboxWorld } from "../../support/relay/inbox";

let w: Awaited<ReturnType<typeof inboxWorld>>;
const quiet = { send: async () => {} };
beforeAll(async () => {
  w = await inboxWorld();
  await w.stock(w.f.products.oil, 50);
  await w.stock(w.f.products.rice, 50);
}, 180_000);
afterAll(async () => w?.close());

const oilOnly = { lines: [{ productId: "", quantityThousandths: 2_000 }] };
const oil = () => ({ lines: [{ ...oilOnly.lines[0]!, productId: w.f.products.oil }] });

test("a paid order reaches the box's picking queue, reserved, and the relay hears it was accepted", async () => {
  const order = await w.f.paid(oil());
  const paidOnRelay = await w.relayAvailable(w.f.products.oil);
  await w.run();
  const mirrored = await w.boxOrder(order.id);
  expect(mirrored).toMatchObject({ channel: "relay", status: "accepted", gross: order.gross });
  expect((await w.boxHolds(order.id)).map((hold) => hold.quantityThousandths)).toEqual([2_000]);
  const queue = await listOrderQueue(w.box, w.orgId, { stage: "preparing" });
  expect(queue.orders.map((row) => row.id)).toContain(order.id);
  expect((await w.relayOrder(order.id))?.status).toBe("accepted");
  expect(await w.events(w.f.world.db, order.id)).toContain("accepted");
  // The box's published figure carries its hold, so the relay stops counting its own sale of the order.
  const [published] = await w.f.world.db
    .select()
    .from(schema.onlineAvailability)
    .where(eq(schema.onlineAvailability.productId, w.f.products.oil));
  expect(await w.relayAvailable(w.f.products.oil)).toBe(
    paidOnRelay + 2_000 + published!.quantityThousandths,
  );
});

test("the same order delivered twice is processed once", async () => {
  const order = await w.f.paid(oil());
  // The box takes the order but its answer never reaches the relay: the next run is offered it again.
  const lost = await w
    .run((path) =>
      path.split("?")[0] === "/relay/orders/events" ? new Response("", { status: 503 }) : undefined,
    )
    .catch(() => "failed");
  expect(lost).toBe("failed");
  expect((await w.relayOrder(order.id))?.status).toBe("paid");
  await w.run();
  const mirrored = await w.box
    .select()
    .from(schema.onlineOrder)
    .where(eq(schema.onlineOrder.id, order.id));
  expect(mirrored).toHaveLength(1);
  expect(await w.boxHolds(order.id)).toHaveLength(1);
  expect((await w.events(w.box, order.id)).filter((s) => s === "accepted")).toHaveLength(1);
  expect((await w.events(w.f.world.db, order.id)).filter((s) => s === "accepted")).toHaveLength(1);
  expect((await w.relayOrder(order.id))?.status).toBe("accepted");
});

test("an order the box cannot fill is rejected, refunded and the shopper is told", async () => {
  const single = w.f.substitutes.single;
  const order = await w.f.paid({ lines: [{ productId: single, quantityThousandths: 1_000 }] });
  await w.run();
  expect((await w.boxOrder(order.id))?.status).toBe("refunded");
  expect(await w.boxHolds(order.id)).toEqual([]);
  expect((await w.relayOrder(order.id))?.status).toBe("refunded");
  const before = w.f.refundCalls().length;
  await w.f.sendRefunds();
  expect(w.f.refundCalls().length).toBe(before + 1);
  const told = w.f.world.sent.find(
    (m) =>
      m.type === "order.status" &&
      (m.payload as { orderId: string; status: string }).orderId === order.id &&
      (m.payload as { status: string }).status === "refunded",
  );
  expect(told).toBeDefined();
  const texts: string[] = [];
  const sms = { send: async (_to: string[], text: string) => void texts.push(text) } as never;
  await deliverNotification(
    { db: w.f.world.db, appVersion: "test", sms },
    deliveryOf(told!).delivery,
  );
  expect(texts.join()).toMatch(/cancelled and refunded.*on its way back to you/);
});

test("a price changed after the order: the paid price is honoured and the mismatch flagged", async () => {
  const order = await w.f.paid();
  const paidLines = await w.f.lines(order);
  // The shop reprices rice on the box before the order reaches it.
  await w.box.insert(schema.price).values({
    orgId: w.orgId,
    productId: w.f.products.rice,
    branchId: null,
    amount: 199_000,
    validFrom: new Date(Date.now() - 1_000),
  } as never);
  await w.run();
  const staff = (await readStaffOrder(w.box, w.orgId, order.id))!;
  expect(staff.status).toBe("accepted");
  expect(staff.gross).toBe(order.gross);
  const boxLines = await w.box
    .select()
    .from(schema.onlineOrderLine)
    .where(eq(schema.onlineOrderLine.orderId, order.id));
  for (const line of paidLines)
    expect(boxLines.find((row) => row.id === line.id)).toMatchObject({
      priceId: line.priceId,
      gross: line.gross,
    });
  const rice = paidLines.find((line) => line.productId === w.f.products.rice)!;
  expect(staff.priceCheck).toEqual([
    expect.objectContaining({ lineId: rice.id, paid: rice.gross, paidPriceId: rice.priceId }),
  ]);
  expect(staff.priceCheck![0]!.now).not.toBe(rice.gross);
});

test("status events go up: picked in full and handed over on the box completes the order on the relay", async () => {
  const order = await w.f.paid(oil());
  await w.run();
  await startPicking(w.box, w.ctx, { id: order.id });
  for (const line of (await w.f.lines(order)).filter((row) => row.productId))
    await recordPick(w.box, w.ctx, {
      id: order.id,
      lineId: line.id,
      pickedThousandths: line.quantityThousandths,
    });
  await finishStoreOrder(w.box, w.ctx, quiet, order.id);
  await handOverStoreOrder(w.box, w.ctx, quiet, order.id);
  // The goods left the box's shelf at hand-over; its hold is gone.
  expect(await w.boxHolds(order.id)).toEqual([]);
  const [sold] = await w.box
    .select()
    .from(schema.stockMovement)
    .where(
      and(eq(schema.stockMovement.orderId, order.id), eq(schema.stockMovement.reason, "sale")),
    );
  expect(sold?.quantityThousandths).toBe(-2_000);
  await w.run();
  expect((await w.relayOrder(order.id))?.status).toBe("completed");
  expect(await w.events(w.f.world.db, order.id)).toEqual(
    expect.arrayContaining(["accepted", "picking", "ready", "completed"]),
  );
  // The relay tells the shopper; the box never texts them for a relayed order.
  const texts: string[] = [];
  const sms = { send: async (_to: string[], text: string) => void texts.push(text) } as never;
  await deliverNotification(
    { db: w.box, appVersion: "test", sms },
    deliveryOf({
      id: crypto.randomUUID(),
      orgId: w.orgId,
      v: 1,
      sequence: "0",
      type: "order.status",
      payload: { orderId: order.id, status: "completed" },
    }).delivery,
  );
  expect(texts).toEqual([]);
});

test("a relay timeout gives the box's stock back; a box cancel refunds on the relay", async () => {
  const late = await w.f.paid(oil());
  await w.run();
  await refundPaidOrder(w.f.world.db, w.f.ctx, { id: late.id, reason: "not_fulfilled" });
  await w.run();
  expect((await w.boxOrder(late.id))?.status).toBe("refunded");
  expect(await w.boxHolds(late.id)).toEqual([]);

  const dropped = await w.f.paid(oil());
  await w.run();
  await cancelStoreOrder(w.box, w.ctx, quiet, dropped.id);
  expect((await w.boxOrder(dropped.id))?.status).toBe("refunded");
  expect(await w.boxHolds(dropped.id)).toEqual([]);
  await w.run();
  expect((await w.relayOrder(dropped.id))?.status).toBe("refunded");
});

test("an accept whose workflow wake was lost is woken again when the box retries", async () => {
  const order = await w.f.paid(oil());
  const events = { events: [{ id: order.id, status: "accepted" }], open: [] };
  const lost = { send: async () => Promise.reject(new Error("engine unavailable")) };
  await expect(applyRelayEvents(w.f.world.db, w.f.ctx, lost, events)).rejects.toThrow();
  expect((await w.relayOrder(order.id))?.status).toBe("accepted");
  const woken: string[] = [];
  const flows = { send: async (id: string, type: string) => void woken.push(`${id} ${type}`) };
  await applyRelayEvents(w.f.world.db, w.f.ctx, flows, events);
  expect(woken).toEqual([`${order.id} store.accepted`]);
});

test("a tax-only change is flagged though the price version and gross are unchanged", async () => {
  const [before] = await w.box.select().from(schema.org).where(eq(schema.org.id, w.orgId));
  const order = await w.f.paid(oil());
  const [line] = await w.f.lines(order);
  // The box is no longer VAT registered: the same inclusive price now carries no VAT.
  await w.box.update(schema.org).set({ vatRegisteredFrom: null }).where(eq(schema.org.id, w.orgId));
  await w.run();
  await w.box
    .update(schema.org)
    .set({ vatRegisteredFrom: before!.vatRegisteredFrom })
    .where(eq(schema.org.id, w.orgId));
  const staff = (await readStaffOrder(w.box, w.orgId, order.id))!;
  expect(staff.priceCheck).toEqual([
    expect.objectContaining({
      lineId: line!.id,
      paidPriceId: line!.priceId,
      priceId: line!.priceId,
    }),
  ]);
});
