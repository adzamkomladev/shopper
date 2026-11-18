// v1.5 Day 47: the box's Publisher keeps its relay org's catalogue equal to the box's online projection. The first
// run sends everything; later runs send only what changed, and nothing the shop keeps private ever leaves the box.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxRelayPublisher } from "@shopper/adapters-box";
import {
  archiveProduct,
  createProduct,
  saveCategory,
  saveSupplier,
  setPrice,
  updateProduct,
} from "@shopper/core/catalogue";
import { relayProjection } from "@shopper/core/relay";
import { readStoreProduct } from "@shopper/core/storefront";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../../support/migration/archive";
import { db as cloudDb } from "../auth/setup";
import { enrol, relayCloud, type Box } from "./support";

type Batch = Record<string, Record<string, unknown>[]>;
let cloud: Awaited<ReturnType<typeof relayCloud>>;
let box: Awaited<ReturnType<typeof emptyDatabase>>;
let shop: Box;
let ctx: ReturnType<typeof provisioningContext>;
const sent: Batch[] = [];
const branches: string[] = [];
const products: string[] = [];
let department: string;
let drinks: string;

beforeAll(async () => {
  cloud = await relayCloud();
  shop = await cloud.box();
  await enrol(shop);
  box = await emptyDatabase();
  ctx = provisioningContext(shop.licence.org);
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `osu-${Date.now().toString(36)}` });
  for (const name of ["Osu", "Spintex"]) {
    const storeId = v7();
    await box.db.insert(schema.store).values({ id: storeId, orgId: ctx.orgId, name });
    for (const suffix of name === "Osu" ? ["Main", "Annex"] : ["Main"]) {
      const id = v7();
      await box.db
        .insert(schema.branch)
        .values({ id, orgId: ctx.orgId, storeId, name: `${name} ${suffix}` });
      branches.push(id);
    }
  }
  department = (await saveCategory(box.db, ctx, { data: { name: "Groceries" } })).id;
  drinks = (await saveCategory(box.db, ctx, { data: { name: "Drinks", parentId: department } })).id;
  const supplier = await saveSupplier(box.db, ctx, {
    data: { name: "Secret Wholesale Ltd", phone: "0244111222", tin: "C0001234567" },
  });
  for (let index = 0; index < 40; index += 1) {
    const { id } = await createProduct(box.db, ctx, {
      sku: `SKU-${index}`,
      name: `Product ${index}`,
      baseUnit: "each",
      taxClass: "standard",
      categoryId: index % 2 ? drinks : department,
      supplierId: supplier.id,
      onlineVisible: index !== 39,
    });
    products.push(id);
    await setPrice(box.db, ctx, { productId: id, data: { amount: 10_000 + index * 100 } });
    if (index % 10 === 0)
      await setPrice(box.db, ctx, {
        productId: id,
        data: { amount: 9_000, branchId: branches[1] },
      });
    await box.db.insert(schema.stockMovement).values({
      orgId: ctx.orgId,
      branchId: branches[0]!,
      productId: id,
      reason: "adjustment",
      quantityThousandths: 7_000,
      occurredAt: new Date(),
    });
  }
  await box.db.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, ctx.orgId));
}, 180_000);
afterAll(async () => box?.close());

const publisher = () =>
  boxRelayPublisher({
    withDatabase: (run) => run(box.db),
    appVersion: ctx.appVersion,
    send: async (path, init) => {
      sent.push(JSON.parse(init.body) as Batch);
      return cloud.send(shop, path, init);
    },
  });
const publish = async () => {
  const flows = publisher();
  const from = sent.length;
  await flows.start(ctx.orgId, { orgId: ctx.orgId });
  await flows.idle();
  return sent.slice(from);
};
const rows = (batches: Batch[]) =>
  batches.reduce((sum, batch) => sum + Object.values(batch).flat().length, 0);
/** A new product listed online, so earlier tests' hiding and archiving cannot touch it. */
const fresh = async (sku: string) =>
  (
    await createProduct(box.db, ctx, {
      sku,
      name: sku,
      baseUnit: "each",
      taxClass: "standard",
      onlineVisible: true,
    })
  ).id;
const same = async () =>
  expect(await relayProjection(cloudDb, ctx.orgId)).toEqual(
    await relayProjection(box.db, ctx.orgId),
  );

test("a snapshot, then 100 changes: the relay's catalogue equals the box's projection each time", async () => {
  const snapshot = await publish();
  await same();
  const total = rows(snapshot);
  // 2 stores, 3 branches, 2 categories, 39 visible products, their 39 shop prices and 4 branch prices.
  expect(total).toBe(2 + 3 + 2 + 39 + 43);
  const changes = [
    (i: number) =>
      setPrice(box.db, ctx, { productId: products[i % 39]!, data: { amount: 20_000 + i } }),
    (i: number) =>
      updateProduct(box.db, ctx, { id: products[i % 39]!, data: { name: `Renamed ${i}` } }),
    (i: number) =>
      updateProduct(box.db, ctx, {
        id: products[(i * 7) % 39]!,
        data: { onlineVisible: i % 2 === 0 },
      }),
    async (i: number) => {
      const { id } = await createProduct(box.db, ctx, {
        sku: `NEW-${i}`,
        name: `New ${i}`,
        baseUnit: "each",
        taxClass: "zero-rated",
        categoryId: drinks,
        onlineVisible: true,
      });
      await setPrice(box.db, ctx, { productId: id, data: { amount: 5_000 + i } });
    },
    (i: number) =>
      i % 10 === 4
        ? archiveProduct(box.db, ctx, { id: products[i % 39]! })
        : saveCategory(box.db, ctx, { id: drinks, data: { onlineVisible: i % 3 !== 0 } }),
  ];
  for (let i = 0; i < 100; i += 1) await changes[i % changes.length]!(i);
  const deltas = await publish();
  await same();
  // Only what changed went up, not the catalogue again.
  expect(rows(deltas)).toBeGreaterThan(0);
  expect(rows(deltas)).toBeLessThan(rows(snapshot) + 20 + 20);
  expect(deltas.flatMap((batch) => batch.stores ?? [])).toEqual([]);
  // A product hidden or archived since is withdrawn on the relay, never left listed there.
  const archived = products[4]!;
  const [relayCopy] = await cloudDb
    .select({ onlineVisible: schema.product.onlineVisible })
    .from(schema.product)
    .where(eq(schema.product.id, archived));
  expect(relayCopy?.onlineVisible).toBe(false);
  // Nothing left: a third run sends nothing.
  expect(await publish()).toEqual([]);
});

test("nothing the shop keeps private ever leaves the box", async () => {
  const allowed: Record<string, string[]> = {
    stores: ["id", "name"],
    branches: ["id", "storeId", "name"],
    categories: ["id", "name", "parentId", "onlineVisible"],
    products: ["id", "sku", "name", "categoryId", "taxClass", "baseUnit", "onlineVisible"],
    prices: ["id", "productId", "branchId", "amount", "validFrom", "validTo"],
  };
  expect(sent.length).toBeGreaterThan(0);
  for (const batch of sent)
    for (const [kind, list] of Object.entries(batch)) {
      expect(Object.keys(allowed)).toContain(kind);
      for (const row of list) expect(Object.keys(row).sort()).toEqual(allowed[kind]!.sort());
    }
  const wire = JSON.stringify(sent);
  expect(wire).not.toMatch(/cost|supplier|movement|stock|Secret Wholesale|0244111222|C0001234567/i);
});

test("a price change on the box is on the relay's store within seconds", async () => {
  const productId = await fresh("FAST-PRICE");
  await setPrice(box.db, ctx, { productId, data: { amount: 66_600 } });
  await publish();
  await setPrice(box.db, ctx, { productId, data: { amount: 77_700 } });
  const started = Date.now();
  await publish();
  const page = await readStoreProduct(cloudDb, ctx.orgId, productId, { branch: branches[2] });
  expect(page?.product.price).toBe(77_700);
  expect(Date.now() - started).toBeLessThan(5_000);
});

test("a relay that refuses the box stops the Publisher and says why", async () => {
  await enrol(shop, false);
  await setPrice(box.db, ctx, { productId: await fresh("REFUSED"), data: { amount: 31_000 } });
  const tried = await publish();
  expect(tried).toHaveLength(1);
  const [org] = await box.db
    .select({ relayError: schema.org.relayError })
    .from(schema.org)
    .where(eq(schema.org.id, ctx.orgId));
  expect(org?.relayError).toMatch(/online orders/i);
  // Switched back on in the cloud, the next run catches up and clears the reason.
  await enrol(shop, true);
  await publish();
  await same();
  const [after] = await box.db
    .select({ relayError: schema.org.relayError })
    .from(schema.org)
    .where(eq(schema.org.id, ctx.orgId));
  expect(after?.relayError).toBeNull();
});

test("with Online Orders off on the box nothing is published", async () => {
  await box.db.update(schema.org).set({ onlineOrders: false }).where(eq(schema.org.id, ctx.orgId));
  await setPrice(box.db, ctx, { productId: await fresh("SWITCHED-OFF"), data: { amount: 44_000 } });
  expect(await publish()).toEqual([]);
});
