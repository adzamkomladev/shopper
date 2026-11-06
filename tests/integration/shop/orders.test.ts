// Day 32 guest checkout: an unpaid online order placed through the shop API, in one audited transaction.
//   GET  /shop/:code/fulfilment?branch   -> { branch, pickup, delivery, deliveryFee, slots[{ start, end, remaining }] }
//   POST /shop/:code/cart                -> the till-priced quote
//   POST /shop/:code/orders              -> 201 the order (status placed); stock held, workflow started, expiry armed
//   GET  /shop/:code/orders/:id?t=key    -> the order, only with the checkout key that placed it
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { Json } from "@shopper/ports";
import { shopHttp } from "../../support/shop/http";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: Awaited<ReturnType<typeof stockShop>>;
const made: Record<string, string> = {};
const launched: { id: string; params: Json }[] = [];
const watched: { orgId: string; branchId: string; expiresAt: Date }[] = [];

beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world, {
    orderFlows: {
      start: async (id, params) => void launched.push({ id, params }),
      send: async () => undefined,
    },
    stockHolds: {
      watch: async (orgId, branchId, expiresAt) =>
        void watched.push({ orgId, branchId, expiresAt }),
    },
    turnstile: async (token) => token === "human",
  });
  shop = await stockShop(world.db, world.a);
  made.oil = await shop.product("Frytol oil 1L", { price: 300_000, stock: [100_000, 100_000] });
  made.rice = await shop.product("Loose rice", {
    price: 185_000,
    baseUnit: "kg",
    stock: [100_000, 100_000],
  });
  // The main branch opens round the clock in hour slots, two orders a slot; the other branch takes no orders.
  await world.db.insert(schema.branchFulfilment).values({
    orgId: world.a.orgId,
    branchId: shop.branches[0],
    pickup: true,
    delivery: false,
    deliveryFee: money(150_000),
    opens: "00:00",
    closes: "23:00",
    slotMinutes: 60,
    slotCapacity: 2,
    leadMinutes: 0,
  });
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
});

const json = async (response: Response) => ({
  status: response.status,
  body: (await response.json()) as Record<string, any>,
});
const slots = async () =>
  (await json(await http.request(`/shop/${world.a.slug}/fulfilment?branch=${shop.branches[0]}`)))
    .body;
const checkout = (over: Record<string, unknown> = {}) => ({
  key: crypto.randomUUID(),
  branch: shop.branches[0],
  lines: [
    { productId: made.oil, quantityThousandths: 2_000 },
    { productId: made.rice, quantityThousandths: 1_500 },
  ],
  fulfilment: "pickup",
  name: "Ama Mensah",
  phone: "0241234567",
  turnstile: "human",
  ...over,
});
const place = async (body: Record<string, unknown>) =>
  json(await http.request(`/shop/${world.a.slug}/orders`, { body }));

test("a guest places an unpaid order that holds its stock, starts its workflow and is audited", async () => {
  const offered = await slots();
  expect(offered).toMatchObject({ pickup: true, delivery: false, branch: { name: "Osu" } });
  const slot = offered.slots[0];
  expect(slot.remaining).toBe(2);
  const quote = await json(
    await http.request(`/shop/${world.a.slug}/cart`, {
      body: { branch: shop.branches[0], lines: checkout().lines },
    }),
  );
  const body = checkout({ slot: slot.start });
  const placed = await place(body);
  expect(placed.status).toBe(201);
  const order = placed.body;
  expect(order).toMatchObject({
    status: "placed",
    channel: "online",
    fulfilment: "pickup",
    slotStart: slot.start,
    branch: { id: shop.branches[0], name: "Osu" },
  });
  // The order is the cart the shopper was shown: same prices, same totals.
  expect(order.totals.gross).toBe(quote.body.totals.gross);
  expect(order.lines.map((line: any) => line.priceId)).toEqual(
    quote.body.lines.map((line: any) => line.priceId),
  );
  expect(new Date(order.holdExpiresAt).getTime() - new Date(order.placedAt).getTime()).toBe(
    30 * 60_000,
  );

  const holds = await world.db
    .select()
    .from(schema.stockHold)
    .where(eq(schema.stockHold.orderId, order.id));
  expect(holds.map((row) => [row.productId, row.quantityThousandths]).sort()).toEqual(
    [
      [made.oil, 2_000],
      [made.rice, 1_500],
    ].sort(),
  );
  expect(launched.at(-1)).toEqual({ id: order.id, params: { orgId: world.a.orgId, id: order.id } });
  expect(watched.at(-1)).toMatchObject({ orgId: world.a.orgId, branchId: shop.branches[0] });
  const [store] = await world.db
    .select()
    .from(schema.store)
    .where(eq(schema.store.id, shop.storeId));
  expect(order.number).toBe(Number(store!.lastSeq));

  const [audit] = await world.db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.command, "order.place"), eq(schema.auditLog.entityId, order.id)));
  const payload = audit!.payload as Record<string, unknown>;
  expect(payload.customerPhone).not.toBe("0241234567");
  expect(String(payload.customerPhone).endsWith("4567")).toBe(true);
  expect((await slots()).slots[0].remaining).toBe(1);

  // Read back with the key that placed it, and with nothing else.
  const path = `/shop/${world.a.slug}/orders/${order.id}`;
  expect((await json(await http.request(`${path}?t=${body.key}`))).body).toMatchObject({
    id: order.id,
    customerName: "Ama Mensah",
  });
  expect((await http.request(`${path}?t=${crypto.randomUUID()}`)).status).toBe(404);
  expect((await http.request(path)).status).toBe(404);
});

test("the same checkout key places one order, and the next order takes the next number", async () => {
  const slot = (await slots()).slots[1].start;
  const body = checkout({ slot });
  const first = await place(body);
  const again = await place(body);
  expect(first.status).toBe(201);
  expect(again.body.id).toBe(first.body.id);
  const rows = await world.db
    .select()
    .from(schema.onlineOrder)
    .where(eq(schema.onlineOrder.slotStart, new Date(slot)));
  expect(rows).toHaveLength(1);
  const next = await place(checkout({ slot }));
  expect(next.body.number).toBe(first.body.number + 1);
});

test("a full slot, a slot that is not offered, a branch without orders and delivery while it is off are refused", async () => {
  const slot = (await slots()).slots[2].start;
  expect((await place(checkout({ slot }))).status).toBe(201);
  expect((await place(checkout({ slot }))).status).toBe(201);
  const full = await place(checkout({ slot }));
  expect(full).toMatchObject({ status: 409, body: { code: "slot" } });
  const offGrid = new Date(new Date(slot).getTime() + 15 * 60_000).toISOString();
  expect(await place(checkout({ slot: offGrid }))).toMatchObject({
    status: 409,
    body: { code: "slot" },
  });
  const closed = await place(checkout({ slot, branch: shop.branches[1] }));
  expect(closed).toMatchObject({ status: 409, body: { code: "closed" } });
  const delivery = await place(
    checkout({
      slot: (await slots()).slots[3].start,
      fulfilment: "delivery",
      address: { line1: "12 Oxford St", area: "Osu", city: "Accra" },
    }),
  );
  expect(delivery).toMatchObject({ status: 409, body: { code: "closed" } });
  // A delivery without an address never reaches the branch's settings.
  expect((await place(checkout({ slot, fulfilment: "delivery" }))).status).toBe(400);
});

test("a robot is refused before anything is held", async () => {
  const before = await world.db.select().from(schema.stockHold);
  const refused = await place(checkout({ slot: (await slots()).slots[4].start, turnstile: "bot" }));
  expect(refused.status).toBe(403);
  expect(await world.db.select().from(schema.stockHold)).toHaveLength(before.length);
});

test("a price that changes after the cart was shown is the price the order takes", async () => {
  const [newer] = await world.db
    .insert(schema.price)
    .values({
      orgId: world.a.orgId,
      productId: made.oil!,
      branchId: null,
      amount: money(320_000),
      validFrom: new Date(Date.now() - 1_000),
    })
    .returning();
  const placed = await place(
    checkout({
      slot: (await slots()).slots[5].start,
      lines: [{ productId: made.oil, quantityThousandths: 1_000 }],
    }),
  );
  expect(placed.status).toBe(201);
  expect(placed.body.lines[0]).toMatchObject({ priceId: newer!.id, gross: 320_000 });
  expect(placed.body.totals.gross).toBe(320_000);
});
