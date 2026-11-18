// v1.5 Day 46: a relay org's catalogue is written only by its box. The database refuses every other writer, whatever
// path it takes, unless the transaction says (SET LOCAL shopper.relay) it is that org's publisher.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { context, db, fixture, otherContext } from "../auth/setup";

const relay = () => context.orgId;
const full = () => otherContext.orgId;
const taxClassOf = async (orgId: string) =>
  (
    await db
      .select({ id: schema.taxClass.id })
      .from(schema.taxClass)
      .where(and(eq(schema.taxClass.orgId, orgId), eq(schema.taxClass.code, "standard")))
  )[0]!.id;
const productFor = async (orgId: string, sku: string) => ({
  orgId,
  sku,
  name: `Milo ${sku}`,
  taxClassId: await taxClassOf(orgId),
  baseUnit: "each" as const,
});
const asPublisher = <T>(orgId: string, write: (tx: schema.ShopperTransaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('shopper.relay', ${orgId}, true)`);
    return write(tx);
  });

let productId: string;

beforeAll(async () => {
  [{ id: productId }] = await db
    .insert(schema.product)
    .values(await productFor(relay(), "LOCK-0"))
    .returning({ id: schema.product.id });
  await db.update(schema.org).set({ mode: "relay" }).where(eq(schema.org.id, relay()));
});

test("every catalogue table refuses a relay org's rows outside its publisher", async () => {
  const refused = /written only by its box/;
  await expect(
    db.insert(schema.product).values(await productFor(relay(), "LOCK-1")),
  ).rejects.toThrow();
  for (const [statement, params] of [
    ["INSERT INTO category (org_id, name) VALUES ($1, 'Drinks')", [relay()]],
    ["UPDATE product SET name = 'Changed' WHERE id = $1", [productId]],
    [
      "INSERT INTO price (org_id, product_id, amount, valid_from) VALUES ($1, $2, 50000, now())",
      [relay(), productId],
    ],
    [
      "INSERT INTO product_barcode (org_id, product_id, code) VALUES ($1, $2, '6001234500001')",
      [relay(), productId],
    ],
    ["UPDATE tax_class SET name = 'Changed' WHERE org_id = $1", [relay()]],
    ["DELETE FROM product WHERE id = $1", [productId]],
  ] as const)
    await expect(fixture.client.query(statement, [...params]), statement).rejects.toThrow(refused);
  const [row] = await db
    .select({ name: schema.product.name })
    .from(schema.product)
    .where(eq(schema.product.id, productId));
  expect(row!.name).toBe("Milo LOCK-0");
});

test("a full org's catalogue is untouched by the lock", async () => {
  const [created] = await db
    .insert(schema.product)
    .values(await productFor(full(), "FULL-1"))
    .returning();
  await db
    .update(schema.product)
    .set({ name: "Renamed" })
    .where(eq(schema.product.id, created!.id));
});

test("the publisher's transaction writes exactly its own relay org", async () => {
  await asPublisher(relay(), async (tx) => {
    await tx
      .update(schema.product)
      .set({ name: "Published" })
      .where(eq(schema.product.id, productId));
    await tx.insert(schema.category).values({ orgId: relay(), name: "Published drinks" });
  });
  const [row] = await db
    .select({ name: schema.product.name })
    .from(schema.product)
    .where(eq(schema.product.id, productId));
  expect(row!.name).toBe("Published");
  // Another org's publisher setting does not open this one.
  await expect(
    asPublisher(full(), (tx) =>
      tx.update(schema.product).set({ name: "Hijacked" }).where(eq(schema.product.id, productId)),
    ),
  ).rejects.toThrow();
  // SET LOCAL ends with the transaction: the next plain write is refused again.
  await expect(
    db.update(schema.product).set({ name: "After" }).where(eq(schema.product.id, productId)),
  ).rejects.toThrow();
});
