import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  await migrateDatabase(drizzle(pool, { schema }));
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

test("registration foreign keys carry the names Drizzle generates, so snapshot-based DROP CONSTRAINT works", async () => {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../../../../packages/db/pg/migrations/meta/0007_snapshot.json", import.meta.url),
      "utf8",
    ),
  ) as { tables: Record<string, { foreignKeys: Record<string, unknown> }> };
  // PostgreSQL truncates identifiers to 63 bytes, as Drizzle's generated SQL would be.
  const expected = Object.entries(snapshot.tables)
    .filter(([table]) => table.startsWith("public.registration_"))
    .flatMap(([, table]) => Object.keys(table.foreignKeys))
    .map((name) => name.slice(0, 63))
    .sort();
  const actual = await fixture.client.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
     WHERE contype = 'f' AND conrelid::regclass::text LIKE 'registration_%' ORDER BY conname`,
  );
  expect(expected).toHaveLength(4);
  expect(actual.rows.map((row) => row.conname)).toEqual(expected);
});
