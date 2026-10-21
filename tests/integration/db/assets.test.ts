import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@shopper/db-pg";
import { postgresFixture } from "../../fixtures/postgres";
import { migrateDatabase } from "../../../tooling/database/migrate";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
beforeAll(async () => {
  fixture = await postgresFixture();
  const db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  await migrateDatabase(db);
  const migration = await readFile(
    new URL("../../../packages/db/pg/migrations/0013_assets.sql", import.meta.url),
    "utf8",
  );
  await fixture.client.query(migration);
  await fixture.client.query(migration);
});
afterAll(async () => {
  await fixture?.close();
});

test("asset migration constraint and index names match the owning Drizzle models", async () => {
  for (const table of [
    schema.asset,
    schema.productImport,
    schema.receiptBlock,
    schema.branch,
    schema.device,
    schema.sale,
  ]) {
    const config = getTableConfig(table);
    const constraints = await fixture.client.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass",
      [config.name],
    );
    const names = constraints.rows.map((row) => row.conname);
    for (const check of config.checks) expect(names, config.name).toContain(check.name);
    for (const fk of config.foreignKeys) expect(names, config.name).toContain(fk.getName());
    for (const unique of config.uniqueConstraints)
      expect(names, config.name).toContain(unique.getName());
    const indexes = await fixture.client.query<{
      indexname: string;
      is_unique: boolean;
      is_partial: boolean;
    }>(
      "SELECT ci.relname AS indexname, i.indisunique AS is_unique, i.indpred IS NOT NULL AS is_partial FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid WHERE i.indrelid = $1::regclass",
      [config.name],
    );
    for (const index of config.indexes) {
      const stored = indexes.rows.find((row) => row.indexname === index.config.name);
      expect(stored, config.name).toMatchObject({
        is_unique: index.config.unique,
        is_partial: Boolean(index.config.where),
      });
    }
  }
});

test("current migration metadata includes asset and all published receipt fields", async () => {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../../../packages/db/pg/migrations/meta/0024_snapshot.json", import.meta.url),
      "utf8",
    ),
  );
  for (const table of [
    schema.asset,
    schema.productImport,
    schema.org,
    schema.receiptBlock,
    schema.branch,
    schema.device,
    schema.sale,
  ]) {
    const config = getTableConfig(table);
    const columns = await fixture.client.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [config.name],
    );
    expect(Object.keys(snapshot.tables[`public.${config.name}`].columns).sort()).toEqual(
      columns.rows.map((row) => row.column_name).sort(),
    );
    expect(Object.keys(snapshot.tables[`public.${config.name}`].columns).sort()).toEqual(
      config.columns.map((column) => column.name).sort(),
    );
  }
});
