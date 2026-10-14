// Slice 3: till SQLite migrations are an ordered list driven by PRAGMA user_version; step 0 is the old schema.
import { afterEach, expect, test } from "vite-plus/test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { openTillDatabase, type TillDatabase } from "../../../support/till/storage";
import { legacyTillSchema } from "../../../support/till/legacy";

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

/** A register that shipped before migrations: step-0 schema, user_version 0, real rows. */
async function legacyFile() {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  const path = join(directory, "till.sqlite");
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
  const legacy = new DatabaseSync(path);
  legacy.exec(legacyTillSchema);
  legacy
    .prepare(
      `INSERT INTO till_state (id, org_id, device_id, pull_cursor, pull_initialized) VALUES (?, ?, ?, '42', 1)`,
    )
    .run(v7(), org, device);
  legacy
    .prepare(`INSERT INTO reference (id, org_id, entity, payload) VALUES (?, ?, 'product', ?)`)
    .run(v7(), org, JSON.stringify({ name: "Kept" }));
  legacy.close();
  return path;
}

test("a fresh database is stamped with the latest migration version", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  expect(await version(db)).toBeGreaterThan(0);
});

test("an existing step-0 database opens, upgrades and keeps its rows", async () => {
  const path = await legacyFile();
  db = openTillDatabase(path);
  expect(await version(db)).toBeGreaterThan(0);
  const state = await db.read((tx) =>
    tx.all<{ pull_cursor: string; pull_initialized: number; reference_version: number }>(
      sql`SELECT pull_cursor, pull_initialized, reference_version FROM till_state`,
    ),
  );
  expect(state).toEqual([{ pull_cursor: "42", pull_initialized: 1, reference_version: 1 }]);
  const kept = await db.read((tx) =>
    tx.all<{ payload: string }>(sql`SELECT payload FROM reference`),
  );
  expect(kept).toEqual([{ payload: JSON.stringify({ name: "Kept" }) }]);
});

test("the upgraded legacy database has the same schema as a fresh one", async () => {
  const path = await legacyFile();
  db = openTillDatabase(path);
  const upgraded = await schemaOf(db);
  const upgradedVersion = await version(db);
  expect(upgradedVersion).toBeGreaterThan(0);
  await db.close();
  db = openTillDatabase(join(directory, "fresh.sqlite"));
  expect(await version(db)).toBe(upgradedVersion);
  // Column order differs after ALTER TABLE, so compare table and index names, not their SQL text.
  expect((await schemaOf(db)).map((row) => row.name)).toEqual(upgraded.map((row) => row.name));
});

test("reopening is idempotent: same version, same schema, same rows", async () => {
  const path = await legacyFile();
  db = openTillDatabase(path);
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
