// Migration 0026 adds the org's tax settings, the VAT return inputs and the org-setting feed entity. It must
// replay without changing anything, and a replay must never re-register a shop that turned registration off.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";

const dir = new URL("../../../../packages/db/pg/migrations/", import.meta.url);
const context = provisioningContext();
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let migration: string;
const q = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  fixture.client.query<T>(text, values).then((result) => result.rows);

beforeAll(async () => {
  fixture = await postgresFixture();
  const db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  migration = (await readFile(new URL("0026_tax.sql", dir), "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );
  await provisionOrg(db, context, { name: "Tax tenant" });
});
afterAll(async () => {
  await fixture?.close();
});

const catalog = () =>
  q<{ v: string }>(`
    SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') AS v
      FROM information_schema.columns WHERE table_schema = 'public'
    UNION ALL SELECT conrelid::regclass || '.' || conname || ':' || pg_get_constraintdef(oid)
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    ORDER BY 1`);

test("migration 0026 is journalled at idx 26 and replaying it twice changes nothing", async () => {
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dir), "utf8"));
  expect(journal.entries.find((e: { idx: number }) => e.idx === 26)).toMatchObject({
    tag: "0026_tax",
  });
  const before = await catalog();
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  expect(await catalog()).toEqual(before);
});

test("a new org is registered, and a replay leaves an unregistered org alone", async () => {
  const org = async () =>
    (
      await q<{ vat_registered_from: string | null; price_mode: string }>(
        "SELECT vat_registered_from::text, price_mode FROM org WHERE id = $1",
        [context.orgId],
      )
    )[0]!;
  expect(await org()).toEqual({ vat_registered_from: "2000-01-01", price_mode: "inclusive" });
  await q("UPDATE org SET vat_registered_from = NULL WHERE id = $1", [context.orgId]);
  await fixture.client.query(migration);
  expect((await org()).vat_registered_from).toBeNull();
});

test("the feed takes org-setting rows and VAT return inputs cannot be negative or mis-dated", async () => {
  const constraint = await q<{ def: string }>(
    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'store_change_entity'",
  );
  expect(constraint[0]!.def).toContain("org-setting");
  await expect(
    q("INSERT INTO vat_return (org_id, period, input_vat) VALUES ($1, '2026-13', 0)", [
      context.orgId,
    ]),
  ).rejects.toThrow();
  await expect(
    q("INSERT INTO vat_return (org_id, period, input_vat) VALUES ($1, '2026-10', -1)", [
      context.orgId,
    ]),
  ).rejects.toThrow();
});
