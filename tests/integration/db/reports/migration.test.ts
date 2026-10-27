// Migration 0030 adds store hours, the store-day record, the report rollups and the occurred_at indexes. It must
// replay without changing anything.
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

test("migration 0030 is journalled at idx 30 and replaying it twice changes nothing", async () => {
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dir), "utf8"));
  expect(journal.entries.find((e: { idx: number }) => e.idx === 30)).toMatchObject({
    tag: "0030_reports",
  });
  const migration = (await readFile(new URL("0030_reports.sql", dir), "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );
  const before = await catalog();
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  expect(await catalog()).toEqual(before);
});

test("a store trades 07:00 to 21:00 by default and cannot close before it opens", async () => {
  const [org] = await q<{ id: string }>(`INSERT INTO org (name) VALUES ('Hours') RETURNING id`);
  const [store] = await q<{ opens_at: string; closes_at: string }>(
    `INSERT INTO store (org_id, name) VALUES ('${org!.id}', 'Main') RETURNING opens_at, closes_at`,
  );
  expect(store).toEqual({ opens_at: "07:00:00", closes_at: "21:00:00" });
  await expect(
    q(
      `INSERT INTO store (org_id, name, opens_at, closes_at) VALUES ('${org!.id}', 'Late', '20:00', '08:00')`,
    ),
  ).rejects.toThrow(/store_hours/);
});
