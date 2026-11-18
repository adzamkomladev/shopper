// v1.5 Day 46: the box's publish is the one writer of its relay org's catalogue. A batch lands as one audited command
// in the relay org's chain, and sending it again changes nothing. Day 47: stores, branches and prices travel too, and
// the relay's store prices a published product from them.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { context, db } from "../auth/setup";
import { readStoreProduct } from "@shopper/core/storefront";
import { enrol, relayCloud, type Box } from "./support";

let cloud: Awaited<ReturnType<typeof relayCloud>>;
let shop: Box;
const drinks = v7();
const milo = v7();
const osu = v7();
const osuBranch = v7();
const shelf = v7();

beforeAll(async () => {
  cloud = await relayCloud();
  shop = await cloud.box();
  await enrol(shop);
});

const batch = () => ({
  stores: [{ id: osu, name: "Osu Mart" }],
  branches: [{ id: osuBranch, storeId: osu, name: "Osu" }],
  categories: [{ id: drinks, name: "Drinks", parentId: null, onlineVisible: true }],
  products: [
    {
      id: milo,
      sku: "MILO-400",
      name: "Milo 400g",
      categoryId: drinks,
      taxClass: "standard",
      baseUnit: "each",
      onlineVisible: true,
    },
  ],
  prices: [
    {
      id: shelf,
      productId: milo,
      branchId: null,
      amount: 450_000,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
    },
  ],
});
const publish = (body: unknown) =>
  cloud.send(shop, "/relay/publish", { method: "POST", body: JSON.stringify(body) });
const products = () =>
  db.select().from(schema.product).where(eq(schema.product.orgId, shop.licence.org));

test("a published batch writes the relay org's catalogue, audited in its chain", async () => {
  const published = await publish(batch());
  expect(published.status).toBe(200);
  expect(await published.json()).toEqual({
    stores: 1,
    branches: 1,
    categories: 1,
    products: 1,
    prices: 1,
  });
  const [product] = await products();
  expect(product).toMatchObject({
    id: milo,
    name: "Milo 400g",
    categoryId: drinks,
    onlineVisible: true,
  });
  const audit = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, shop.licence.org),
        eq(schema.auditLog.command, "relay.publish"),
      ),
    );
  expect(audit).toHaveLength(1);

  // The same batch again (a retried upload): same rows, same values.
  expect((await publish(batch())).status).toBe(200);
  expect(await products()).toHaveLength(1);
  // A rename flows up.
  const renamed = batch();
  renamed.products[0]!.name = "Milo 500g";
  expect((await publish(renamed)).status).toBe(200);
  expect((await products())[0]!.name).toBe("Milo 500g");

  // The relay's own store prices the product from the published price, at the published branch.
  const page = await readStoreProduct(db, shop.licence.org, milo, { branch: osuBranch });
  expect(page?.product).toMatchObject({ name: "Milo 500g", price: 450_000 });
});

test("a batch carries only the published fields and cannot reach another org's rows", async () => {
  const withCost = batch();
  Object.assign(withCost.products[0]!, { costPrice: 12_000 });
  expect((await publish(withCost)).status).toBe(400);
  const pricedAtCost = batch();
  Object.assign(pricedAtCost.prices[0]!, { costAmount: 300_000 });
  expect((await publish(pricedAtCost)).status).toBe(400);
  const storeWithPhone = batch();
  Object.assign(storeWithPhone.stores[0]!, { phone: "0244000000" });
  expect((await publish(storeWithPhone)).status).toBe(400);
  // An id that belongs to another shop's product is never updated through this relay.
  const [tax] = await db
    .select({ id: schema.taxClass.id })
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, context.orgId));
  const [foreign] = await db
    .insert(schema.product)
    .values({
      orgId: context.orgId,
      sku: "OTHER-1",
      name: "Other shop's rice",
      taxClassId: tax!.id,
      baseUnit: "each",
    })
    .returning();
  const hijack = batch();
  hijack.products[0] = { ...hijack.products[0]!, id: foreign!.id, sku: "HIJACK", name: "Hijacked" };
  await publish(hijack);
  const [after] = await db
    .select({ orgId: schema.product.orgId, name: schema.product.name })
    .from(schema.product)
    .where(eq(schema.product.id, foreign!.id));
  expect(after).toEqual({ orgId: context.orgId, name: "Other shop's rice" });
});
