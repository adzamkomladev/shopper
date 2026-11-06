// Day 32 reservations: the stock a checkout holds stops the shop and the till overselling the last unit.
// Two shoppers racing for one unit get one order between them; a unit the till already sold cannot be ordered; a hold
// whose time ran out gives the unit back, even before the StockHold alarm has released it.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { shopHttp } from "../../support/shop/http";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: Awaited<ReturnType<typeof stockShop>>;

beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world, {
    orderFlows: { start: async () => undefined, send: async () => undefined },
    stockHolds: { watch: async () => undefined },
  });
  shop = await stockShop(world.db, world.a);
  await world.db.insert(schema.branchFulfilment).values({
    orgId: world.a.orgId,
    branchId: shop.branches[0],
    opens: "00:00",
    closes: "23:00",
    slotCapacity: 500,
    leadMinutes: 0,
  });
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
});

const lastUnit = (name: string) => shop.product(name, { stock: [1_000, 0] });
async function order(productId: string) {
  const fulfilment = await (
    await http.request(`/shop/${world.a.slug}/fulfilment?branch=${shop.branches[0]}`)
  ).json();
  const response = await http.request(`/shop/${world.a.slug}/orders`, {
    body: {
      key: crypto.randomUUID(),
      branch: shop.branches[0],
      lines: [{ productId, quantityThousandths: 1_000 }],
      fulfilment: "pickup",
      slot: fulfilment.slots[0].start,
      name: "Kofi Boateng",
      phone: "0201234567",
    },
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}
const shown = async (productId: string) =>
  (
    await (
      await http.request(`/shop/${world.a.slug}/products/${productId}?branch=${shop.branches[0]}`)
    ).json()
  ).product.available as boolean;

test("two shoppers racing for the last unit get exactly one order, and the store stops showing it", async () => {
  const milo = await lastUnit("Last tin of Milo");
  expect(await shown(milo)).toBe(true);
  const results = await Promise.all([order(milo), order(milo)]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(results.find((result) => result.status === 409)!.body).toMatchObject({
    code: "stock",
    products: [milo],
  });
  expect(await shown(milo)).toBe(false);
  // The refused checkout left nothing behind: one order, one hold.
  const holds = await world.db
    .select()
    .from(schema.stockHold)
    .where(eq(schema.stockHold.productId, milo));
  expect(holds).toHaveLength(1);
});

test("a unit the till sold first cannot be ordered online", async () => {
  const sardines = await lastUnit("Last tin of sardines");
  // A synced till sale lands as a negative stock movement. Availability sums every movement alike, so a bare
  // movement stands in for it (a `sale` movement needs the whole sale row behind it).
  await world.db.insert(schema.stockMovement).values({
    orgId: world.a.orgId,
    branchId: shop.branches[0],
    productId: sardines,
    reason: "adjustment",
    quantityThousandths: -1_000,
  });
  expect(await order(sardines)).toMatchObject({ status: 409, body: { code: "stock" } });
});

test("a hold whose time ran out gives the unit back, before any alarm releases it", async () => {
  const sugar = await lastUnit("Last bag of sugar");
  const first = await order(sugar);
  expect(first.status).toBe(201);
  expect((await order(sugar)).status).toBe(409);
  await world.db
    .update(schema.stockHold)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.stockHold.orderId, first.body.id));
  expect(await shown(sugar)).toBe(true);
  expect((await order(sugar)).status).toBe(201);
});
