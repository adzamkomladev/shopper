import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { readFile } from "node:fs/promises";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
import { violation } from "../../support/violation";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: schema.ShopperDatabase;
const context = provisioningContext();
const orgId = context.orgId;
const ids = { store: v7(), branch: v7(), device: v7(), user: v7(), role: v7(), product: v7() };

beforeAll(async () => {
  fixture = await postgresFixture();
  db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  const migration = await readFile(
    new URL("../../../packages/db/pg/migrations/0015_tenders.sql", import.meta.url),
    "utf8",
  );
  // The migration is idempotent: replaying it over an already migrated database changes nothing.
  await fixture.client.query(migration.replaceAll("--> statement-breakpoint", ""));
  await provisionOrg(db, context, { name: "Tender tenant" });
  await db.insert(schema.store).values({ id: ids.store, orgId, name: "Store" });
  await db
    .insert(schema.branch)
    .values({ id: ids.branch, orgId, storeId: ids.store, name: "Branch", code: "B1" });
  await db
    .insert(schema.device)
    .values({ id: ids.device, orgId, branchId: ids.branch, name: "Till 1", code: "T1" });
  await db.insert(schema.user).values({ id: ids.user, orgId, email: "c@x.test", name: "Cashier" });
  await db.insert(schema.role).values({ id: ids.role, orgId, name: "till" });
  const [taxClass] = await db
    .select()
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, orgId));
  await db.insert(schema.product).values({
    id: ids.product,
    orgId,
    sku: "SKU",
    name: "Milo",
    baseUnit: "each",
    taxClassId: taxClass!.id,
  });
});
afterAll(async () => {
  await fixture?.close();
});

const payment = (over: Partial<typeof schema.payment.$inferInsert> = {}) => ({
  orgId,
  branchId: ids.branch,
  deviceId: ids.device,
  cashierId: ids.user,
  reference: `ref-${v7()}`,
  amount: 250_000 as never,
  phone: "024****567",
  network: "mtn" as const,
  ...over,
});

async function insertSale(over: Partial<typeof schema.sale.$inferInsert> = {}) {
  const sessionId = v7();
  await db.insert(schema.cashierSession).values({
    id: sessionId,
    orgId,
    deviceId: ids.device,
    branchId: ids.branch,
    userId: ids.user,
    roleId: ids.role,
    tokenHash: v7(),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  const [sale] = await db
    .insert(schema.sale)
    .values({
      orgId,
      deviceId: ids.device,
      localId: v7(),
      storeId: ids.store,
      branchId: ids.branch,
      cashierId: ids.user,
      sessionId,
      appVersion: "test",
      deviceTime: new Date(),
      payload: {},
      contentHash: v7(),
      ...over,
    })
    .returning();
  return sale!;
}

test("a payment reference is unique per organisation", async () => {
  const first = payment();
  await db.insert(schema.payment).values(first);
  expect(await violation(db.insert(schema.payment).values(first))).toMatch(/./);
});

test("a payment amount must be positive whole pesewas and its status a known one", async () => {
  expect(
    await violation(db.insert(schema.payment).values(payment({ amount: 250_050 as never }))),
  ).toMatch(/./);
  expect(
    await violation(db.insert(schema.payment).values(payment({ amount: 0 as never }))),
  ).toMatch(/./);
  const lost = fixture.client.query("UPDATE payment SET status = 'lost' WHERE org_id = $1", [
    orgId,
  ]);
  expect(await violation(lost)).toMatch(/payment_status/);
});

test("a confirmed payment settles one tender only: unique(org_id, payment_id)", async () => {
  const [intent] = await db.insert(schema.payment).values(payment()).returning();
  const sale = await insertSale();
  const tender = (position: number) => ({
    orgId,
    saleId: sale.id,
    position,
    kind: "momo" as const,
    amount: 250_000 as never,
    reference: intent!.reference,
    paymentId: intent!.id,
  });
  await db.insert(schema.saleTender).values(tender(0));
  expect(await violation(db.insert(schema.saleTender).values(tender(1)))).toMatch(
    /sale_tender_org_id_payment_id_unique/,
  );
  const other = await insertSale();
  expect(
    await violation(db.insert(schema.saleTender).values({ ...tender(0), saleId: other.id })),
  ).toMatch(/sale_tender_org_id_payment_id_unique/);
});

test("cash and card tenders carry no payment; a MoMo tender needs one", async () => {
  const sale = await insertSale();
  const base = { orgId, saleId: sale.id, amount: 1_000 as never };
  await db.insert(schema.saleTender).values([
    { ...base, position: 0, kind: "cash" },
    { ...base, position: 1, kind: "cash" },
    { ...base, position: 2, kind: "card", approvalCode: "AB12CD", last4: "4242" },
  ]);
  expect(
    await violation(db.insert(schema.saleTender).values({ ...base, position: 3, kind: "momo" })),
  ).toMatch(/sale_tender_momo_payment/);
  expect(
    await violation(db.insert(schema.saleTender).values({ ...base, position: 2, kind: "cash" })),
  ).toMatch(/sale_tender_org_id_sale_id_position_unique/);
});

test("a sale stores status, total, rounding, paid, change and receipt at insert", async () => {
  const plain = await insertSale();
  expect(plain).toMatchObject({ status: "completed", total: null, cashRounding: 0, change: 0 });
  const rounded = await insertSale({
    total: 9_000 as never,
    cashRounding: -500 as never,
    paid: 10_000 as never,
    change: 1_000 as never,
    receipt: { number: "T1-0001" },
  });
  expect(rounded).toMatchObject({ total: 9_000, cashRounding: -500, paid: 10_000, change: 1_000 });
  expect(rounded.receipt).toEqual({ number: "T1-0001" });
});

test("a sale stock movement is negative and tied to its sale", async () => {
  const sale = await insertSale();
  const movement = { orgId, branchId: ids.branch, productId: ids.product, reason: "sale" as const };
  await db
    .insert(schema.stockMovement)
    .values({ ...movement, saleId: sale.id, quantityThousandths: -2_000 });
  const gain = db
    .insert(schema.stockMovement)
    .values({ ...movement, saleId: sale.id, quantityThousandths: 2_000 });
  expect(await violation(gain)).toMatch(/stock_movement_sale/);
  const orphan = db
    .insert(schema.stockMovement)
    .values({ ...movement, quantityThousandths: -1_000 });
  expect(await violation(orphan)).toMatch(/stock_movement_sale/);
  await db
    .insert(schema.stockMovement)
    .values({ ...movement, reason: "adjustment", quantityThousandths: 5_000 });
});

test("the organisation defaults cash rounding to 10p and accepts none", async () => {
  const [row] = await db.select().from(schema.org).where(eq(schema.org.id, orgId));
  expect(row!.cashRounding).toBe("10p");
  await db.update(schema.org).set({ cashRounding: "none" }).where(eq(schema.org.id, orgId));
  const bad = fixture.client.query("UPDATE org SET cash_rounding = '5p' WHERE id = $1", [orgId]);
  expect(await violation(bad)).toMatch(/org_cash_rounding/);
});

test("new tables match their Drizzle models and carry org_id", async () => {
  for (const table of [schema.payment, schema.saleTender, schema.stockMovement]) {
    const config = getTableConfig(table);
    expect(config.columns.map((column) => column.name)).toContain("org_id");
    const found = await fixture.client.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass",
      [config.name],
    );
    const names = found.rows.map((row) => row.conname);
    for (const check of config.checks) expect(names, config.name).toContain(check.name);
    for (const fk of config.foreignKeys) expect(names, config.name).toContain(fk.getName());
    for (const unique of config.uniqueConstraints)
      expect(names, config.name).toContain(unique.getName());
  }
});
