// Till SQLite migrations are an ordered list driven by PRAGMA user_version; the list is one fresh schema step.
import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { openTillDatabase, type TillDatabase } from "../../../support/till/storage";

let directory: string;
let db: TillDatabase | undefined;
afterEach(async () => {
  await db?.close();
  db = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
});

const org = v7();
const device = v7();
const version = (database: TillDatabase) =>
  database
    .read((tx) => tx.all<{ user_version: number }>(sql`PRAGMA user_version`))
    .then((rows) => rows[0]!.user_version);
const schemaOf = (database: TillDatabase) =>
  database.read((tx) =>
    tx.all<{ name: string; sql: string }>(
      sql`SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name`,
    ),
  );

test("a fresh database is stamped with the latest migration version", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  expect(await version(db)).toBeGreaterThan(0);
});

test("reopening is idempotent: same version, same schema, same rows", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  const path = join(directory, "till.sqlite");
  db = openTillDatabase(path);
  await db.transaction((tx) =>
    tx.run(
      sql`INSERT INTO till_state (id, org_id, device_id, pull_cursor, pull_initialized) VALUES (${v7()}, ${org}, ${device}, '42', 1)`,
    ),
  );
  const first = { version: await version(db), schema: await schemaOf(db) };
  expect(first.version).toBeGreaterThan(0);
  await db.close();
  for (let reopen = 0; reopen < 2; reopen++) {
    db = openTillDatabase(path);
    expect(await version(db)).toBe(first.version);
    expect(await schemaOf(db)).toEqual(first.schema);
    expect(
      await db.read((tx) => tx.all<{ n: number }>(sql`SELECT count(*) AS n FROM till_state`)),
    ).toEqual([{ n: 1 }]);
    await db.close();
  }
  db = undefined;
});

test("a new till_state row defaults reference_version to 1", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  await db.transaction((tx) =>
    tx.run(sql`INSERT INTO till_state (id, org_id, device_id) VALUES (${v7()}, ${org}, ${device})`),
  );
  expect(
    await db.read((tx) =>
      tx.all<{ reference_version: number }>(sql`SELECT reference_version FROM till_state`),
    ),
  ).toEqual([{ reference_version: 1 }]);
});

test("FTS5 is available and the catalogue search index is an fts5 table", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  const modules = await db.read((tx) =>
    tx.all<{ name: string }>(sql`SELECT name FROM pragma_module_list WHERE name = 'fts5'`),
  );
  expect(modules).toEqual([{ name: "fts5" }]);
  const virtual = await db.read((tx) =>
    tx.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%fts5%'`,
    ),
  );
  expect(virtual.length).toBeGreaterThan(0);
});
