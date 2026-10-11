import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../tooling/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
const context = provisioningContext();
let taxClassId: string;
beforeAll(async () => {
  fixture = await postgresFixture();
  const db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Catalogue schema" });
  const taxClass = await fixture.client.query<{ id: string }>(
    "SELECT id FROM tax_class WHERE org_id = $1 AND code = 'standard'",
    [context.orgId],
  );
  taxClassId = taxClass.rows[0]!.id;
});
afterAll(async () => {
  await fixture?.close();
});

const product = async (sku: string) =>
  (
    await fixture.client.query<{ id: string; online_visible: boolean }>(
      "INSERT INTO product (org_id, sku, name, tax_class_id, base_unit) VALUES ($1, $2, $3, $4, 'each') RETURNING id, online_visible",
      [context.orgId, sku, `Product ${sku}`, taxClassId],
    )
  ).rows[0]!;

test("migration 0005 can run a second time without changing anything", async () => {
  const file = new URL("../../../packages/db-pg/migrations/0005_catalogue.sql", import.meta.url);
  const statements = (await readFile(file, "utf8")).split("--> statement-breakpoint");
  for (const statement of statements) await fixture.client.query(statement);
});

test("a new product is hidden online until someone turns it on", async () => {
  expect((await product("SCHEMA-1")).online_visible).toBe(false);
});

test("top-level categories are unique by name regardless of case", async () => {
  const insert = "INSERT INTO category (org_id, name) VALUES ($1, $2)";
  await fixture.client.query(insert, [context.orgId, "Beverages"]);
  await expect(fixture.client.query(insert, [context.orgId, "beverages"])).rejects.toMatchObject({
    code: "23505",
  });
});

test("a barcode belongs to one product per organisation", async () => {
  const first = await product("SCHEMA-2");
  const second = await product("SCHEMA-3");
  const insert =
    "INSERT INTO product_barcode (org_id, product_id, code, quantity_thousandths) VALUES ($1, $2, $3, $4)";
  await fixture.client.query(insert, [context.orgId, first.id, "6001234567890", 1000]);
  await expect(
    fixture.client.query(insert, [context.orgId, second.id, "6001234567890", 1000]),
  ).rejects.toMatchObject({ code: "23505" });
  await expect(
    fixture.client.query(insert, [context.orgId, second.id, "6001234567891", 0]),
  ).rejects.toMatchObject({ code: "23514" });
});

test("price versions are append-only, positive and end after they start", async () => {
  const { id } = await product("SCHEMA-4");
  const insert =
    "INSERT INTO price (org_id, product_id, amount, valid_from, valid_to) VALUES ($1, $2, $3, $4, $5) RETURNING id";
  const price = await fixture.client.query<{ id: string }>(insert, [
    context.orgId,
    id,
    125000,
    "2026-10-01T00:00:00Z",
    null,
  ]);
  await expect(
    fixture.client.query("UPDATE price SET amount = 1 WHERE id = $1", [price.rows[0]!.id]),
  ).rejects.toThrow(/append-only/);
  await expect(
    fixture.client.query("DELETE FROM price WHERE id = $1", [price.rows[0]!.id]),
  ).rejects.toThrow(/append-only/);
  await expect(
    fixture.client.query(insert, [context.orgId, id, 0, "2026-10-01T00:00:00Z", null]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    fixture.client.query(insert, [
      context.orgId,
      id,
      1,
      "2026-10-02T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});
