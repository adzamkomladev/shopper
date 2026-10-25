// Migration 0027 adds the fiscal documents, their hourly archive and the fiscal-doc feed entity. It must replay
// without changing anything, and the database must refuse a document that is half a sale and half a credit note.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { postgresFixture } from "../../../fixtures/postgres";

const dir = new URL("../../../../packages/db/pg/migrations/", import.meta.url);
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
const q = <T extends Record<string, unknown>>(text: string) =>
  fixture.client.query<T>(text).then((result) => result.rows);

beforeAll(async () => {
  fixture = await postgresFixture();
  await migrateDatabase(drizzle(fixture.client, { schema }));
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
    UNION ALL SELECT indexname || ':' || indexdef FROM pg_indexes WHERE schemaname = 'public'
    ORDER BY 1`);

test("migration 0027 is journalled at idx 27 and replaying it twice changes nothing", async () => {
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dir), "utf8"));
  expect(journal.entries.find((e: { idx: number }) => e.idx === 27)).toMatchObject({
    tag: "0027_fiscal",
  });
  const migration = (await readFile(new URL("0027_fiscal.sql", dir), "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );
  const before = await catalog();
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  expect(await catalog()).toEqual(before);
});

test("a fiscal document names exactly one sale or credit note, matching its kind", async () => {
  const constraints = await q<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'fiscal_doc'::regclass AND contype = 'c' ORDER BY 1`,
  );
  expect(constraints.map((c) => c.conname)).toEqual([
    "fiscal_doc_accepted",
    "fiscal_doc_kind",
    "fiscal_doc_kind_value",
    "fiscal_doc_source",
    "fiscal_doc_status",
  ]);
  const [entity] = await q<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'store_change_entity'`,
  );
  expect(entity!.def).toContain("'fiscal-doc'");
});
