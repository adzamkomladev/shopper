// v1.5 Day 49: the box publishes what each branch can still sell online (on hand − holds − the shop's buffer), floored
// to a ladder of steps so only threshold crossings go up, a rise at most every 30 s and a sell-out at once. The relay's
// store then lists exactly what the box can fill, never more.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createProduct, setPrice } from "@shopper/core/catalogue";
import { publishPending, relayProjection } from "@shopper/core/relay";
import { availableOf } from "@shopper/core/stock";
import { listStoreProducts } from "@shopper/core/storefront";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../../support/migration/archive";
import { db as cloudDb, fixture } from "../auth/setup";
import { enrol, relayCloud, type Box } from "./support";

type Batch = Record<string, { id: string; branches?: { branchId: string; available: number }[] }[]>;
let cloud: Awaited<ReturnType<typeof relayCloud>>;
let box: Awaited<ReturnType<typeof emptyDatabase>>;
let shop: Box;
let ctx: ReturnType<typeof provisioningContext>;
let branchId: string;
const sent: Batch[] = [];
const start = new Date("2026-11-26T10:00:00Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

beforeAll(async () => {
  cloud = await relayCloud();
  shop = await cloud.box();
  await enrol(shop);
  box = await emptyDatabase();
  ctx = provisioningContext(shop.licence.org);
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `osu-${Date.now().toString(36)}` });
  const storeId = v7();
  branchId = v7();
  await box.db.insert(schema.store).values({ id: storeId, orgId: ctx.orgId, name: "Osu" });
  await box.db
    .insert(schema.branch)
    .values({ id: branchId, orgId: ctx.orgId, storeId, name: "Main" });
  await box.db.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, ctx.orgId));
}, 180_000);
afterAll(async () => box?.close());

const publish = async (now: Date) => {
  const from = sent.length;
  await publishPending(
    box.db,
    ctx,
    {
      send: async (path, init) => {
        if (path === "/relay/publish") sent.push(JSON.parse(init.body) as Batch);
        return cloud.send(shop, path, init);
      },
    },
    now,
  );
  return sent.slice(from).flatMap((batch) => batch.availability ?? []);
};
const product = async (sku: string, onHand: number) => {
  const { id } = await createProduct(box.db, ctx, {
    sku,
    name: sku,
    baseUnit: "each",
    taxClass: "standard",
    onlineVisible: true,
  });
  await setPrice(box.db, ctx, { productId: id, data: { amount: 12_000 } });
  await move(id, onHand);
  return id;
};
// Sales and receipts alike, as the stock ledger sees them: a signed adjustment (a sale row needs its document).
const move = (productId: string, units: number) =>
  box.db.insert(schema.stockMovement).values({
    orgId: ctx.orgId,
    branchId,
    productId,
    reason: "adjustment",
    quantityThousandths: units * 1000,
    occurredAt: start,
  });
/** What the relay's store will still sell of the product at the branch, in units. */
const relayAvailable = async (productId: string, now: Date) => {
  const [row] = await cloudDb
    .select({ available: availableOf(ctx.orgId, branchId, sql`${schema.product.id}`, now) })
    .from(schema.product)
    .where(and(eq(schema.product.orgId, ctx.orgId), eq(schema.product.id, productId)));
  return (row?.available ?? 0) / 1000;
};
const boxAvailable = async (productId: string, now: Date) => {
  const [row] = await box.db
    .select({ available: availableOf(ctx.orgId, branchId, sql`${schema.product.id}`, now) })
    .from(schema.product)
    .where(and(eq(schema.product.orgId, ctx.orgId), eq(schema.product.id, productId)));
  return (row?.available ?? 0) / 1000;
};

test("100 in-store sales of one SKU publish its availability a handful of times, never above the box's", async () => {
  const milo = await product("MILO-400", 120);
  await publish(at(0));
  expect(await relayAvailable(milo, at(0))).toBe(100);
  let published = 0;
  for (let sale = 1; sale <= 100; sale += 1) {
    await move(milo, -1);
    const now = at(sale * 2);
    published += (await publish(now)).filter((row) => row.id === milo).length;
    expect(await relayAvailable(milo, now)).toBeLessThanOrEqual(await boxAvailable(milo, now));
  }
  expect(published).toBeGreaterThan(0);
  // Each branch's figure and nothing else leaves the box: no on-hand, cost or movement detail.
  for (const row of sent.flatMap((batch) => batch.availability ?? []))
    for (const entry of row.branches ?? [])
      expect(Object.keys(entry).sort()).toEqual(["available", "branchId"]);
  expect(published).toBeLessThanOrEqual(5);
  // 20 left on the box: the relay shows 20 once the last crossing is out.
  await publish(at(400));
  expect(await relayAvailable(milo, at(400))).toBe(20);
  // The relay reads its copy with the same projection: equal to the box's.
  expect((await relayProjection(cloudDb, ctx.orgId, at(400))).availability).toEqual(
    (await relayProjection(box.db, ctx.orgId, at(400))).availability,
  );
});

test("a sell-out goes up at once; a restock waits until 30 s after the last publish", async () => {
  const bread = await product("BREAD", 3);
  await publish(at(1000));
  await move(bread, -3);
  // Inside the 30 s window, but sold out: published on this run and gone from the store.
  expect((await publish(at(1005))).map((row) => row.id)).toContain(bread);
  expect(await relayAvailable(bread, at(1005))).toBe(0);
  const listed = await listStoreProducts(
    cloudDb,
    ctx.orgId,
    { branch: branchId, q: "BREAD" },
    at(1005),
  );
  expect(listed.products).toEqual([]);
  await move(bread, 50);
  expect((await publish(at(1015))).map((row) => row.id)).not.toContain(bread);
  expect(await relayAvailable(bread, at(1015))).toBe(0);
  expect((await publish(at(1036))).map((row) => row.id)).toContain(bread);
  expect(await relayAvailable(bread, at(1036))).toBe(50);
});

test("a drop to a lower step inside 30 s goes up at once, so the relay never offers more", async () => {
  const tins = await product("TINS", 3);
  await publish(at(3000));
  expect(await relayAvailable(tins, at(3000))).toBe(3);
  await move(tins, -1);
  // Five seconds on, 2 left: the relay must not keep offering 3.
  expect((await publish(at(3005))).map((row) => row.id)).toContain(tins);
  expect(await relayAvailable(tins, at(3005))).toBe(2);
});

test("the shop's safety buffer comes off before the ladder", async () => {
  const eggs = await product("EGGS", 12);
  await box.db.update(schema.org).set({ onlineBuffer: 5000 }).where(eq(schema.org.id, ctx.orgId));
  await publish(at(2000));
  // 12 on hand − 5 held back = 7, floored to the step below: 5.
  expect(await relayAvailable(eggs, at(2000))).toBe(5);
  await box.db.update(schema.org).set({ onlineBuffer: 0 }).where(eq(schema.org.id, ctx.orgId));
});

test("a relay org's availability is written only by its box", async () => {
  const [productRow] = await cloudDb
    .select({ id: schema.product.id })
    .from(schema.product)
    .where(eq(schema.product.orgId, ctx.orgId))
    .limit(1);
  await expect(
    fixture.client.query(
      "UPDATE online_availability SET quantity_thousandths = 999000 WHERE org_id = $1 AND product_id = $2",
      [ctx.orgId, productRow!.id],
    ),
  ).rejects.toThrow(/written only by its box/);
});
