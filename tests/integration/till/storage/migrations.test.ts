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

test("the refund steps keep existing sale movements and allow returns beside them", async () => {
  const { Database } = await import("../../../support/till/sqlcipher");
  const { tillMigrations } = await import("@shopper/db-sqlite");
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  const path = join(directory, "till.sqlite");
  const old = new Database(path);
  const saleId = v7();
  const lineId = v7();
  old.exec("PRAGMA foreign_keys=ON");
  for (const step of tillMigrations.slice(0, 6)) old.exec(step);
  old.exec(
    `PRAGMA user_version=6;
     INSERT INTO local_sale (id, org_id, device_id, local_id, payload, content_hash) VALUES ('${saleId}', '${org}', '${device}', '${saleId}', '{}', 'h');
     INSERT INTO stock_movement (id, org_id, device_id, branch_id, product_id, sale_id, sale_line_id, quantity_thousandths, reason, occurred_at)
       VALUES ('${v7()}', '${org}', '${device}', '${v7()}', '${v7()}', '${saleId}', '${lineId}', -3000, 'sale', '2026-01-01T00:00:00.000Z')`,
  );
  old.close();

  db = openTillDatabase(path);
  expect(await version(db)).toBe(tillMigrations.length);
  const movements = () =>
    db!.read((tx) =>
      tx.all<{ reason: string; quantity_thousandths: number }>(
        sql`SELECT reason, quantity_thousandths FROM stock_movement`,
      ),
    );
  expect(await movements()).toEqual([{ reason: "sale", quantity_thousandths: -3000 }]);

  const insert = (reason: string, quantity: number, line: string | null, refund: string | null) =>
    db!.transaction((tx) =>
      tx.run(sql`INSERT INTO stock_movement (id, org_id, device_id, branch_id, product_id, sale_id, sale_line_id, refund_id, refund_line_id, quantity_thousandths, reason, occurred_at)
        VALUES (${v7()}, ${org}, ${device}, ${v7()}, ${v7()}, ${line ? saleId : null}, ${line}, ${refund}, ${refund ? v7() : null}, ${quantity}, ${reason}, '2026-01-02T00:00:00.000Z')`),
    );
  await insert("return", 1000, lineId, v7());
  await insert("return", 1000, lineId, v7());
  await insert("return", 500, null, v7());
  expect(await movements()).toHaveLength(4);
  await expect(insert("sale", -1000, lineId, null)).rejects.toThrow();
  await expect(insert("sale", 1000, v7(), null)).rejects.toThrow();
  await expect(insert("return", -1000, null, v7())).rejects.toThrow();
  await expect(insert("return", 1000, null, null)).rejects.toThrow();
});

const columns = (database: TillDatabase, table: string) =>
  database
    .read((tx) =>
      tx.all<{ name: string }>(sql.raw(`SELECT name FROM pragma_table_info('${table}')`)),
    )
    .then((rows) => rows.map((row) => row.name));

test("step 8 adds the shift tables, the shift_id columns and the one-open-shift index", async () => {
  const { tillMigrations } = await import("@shopper/db-sqlite");
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  expect(await version(db)).toBe(tillMigrations.length);
  expect(await columns(db, "shift")).toEqual(
    expect.arrayContaining([
      "id",
      "org_id",
      "device_id",
      "branch_id",
      "store_id",
      "status",
      "opened_at",
      "opened_by",
      "opened_session_id",
      "float",
      "float_counts",
      "declaration",
      "closed_at",
      "closed_by",
      "approver_id",
      "report",
      "anchor_seq",
      "anchor_hash",
      "attempts",
      "next_attempt_at",
      "blocked_code",
      "blocked_reason",
      "accepted_at",
      "result",
    ]),
  );
  expect(await columns(db, "shift_movement")).toEqual(
    expect.arrayContaining(["id", "org_id", "shift_id", "kind", "amount", "reason", "actor_id"]),
  );
  expect(await columns(db, "shift_movement")).toEqual(expect.arrayContaining(["session_id", "at"]));
  expect(await columns(db, "local_sale")).toContain("shift_id");
  expect(await columns(db, "refund")).toContain("shift_id");
  const indexes = await db.read((tx) =>
    tx.all<{ name: string; sql: string | null }>(
      sql`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'shift_current'`,
    ),
  );
  expect(indexes).toHaveLength(1);
  expect(indexes[0]!.sql).toMatch(/UNIQUE/i);
  expect(indexes[0]!.sql).toMatch(/WHERE/i);
});

test("step 8 keeps existing sales and refunds, now without a shift", async () => {
  const { Database } = await import("../../../support/till/sqlcipher");
  const { tillMigrations } = await import("@shopper/db-sqlite");
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  const path = join(directory, "till.sqlite");
  const old = new Database(path);
  const saleId = v7();
  for (const step of tillMigrations.slice(0, 7)) old.exec(step);
  old.exec(
    `PRAGMA user_version=7;
     INSERT INTO local_sale (id, org_id, device_id, local_id, payload, content_hash) VALUES ('${saleId}', '${org}', '${device}', '${saleId}', '{}', 'h');
     INSERT INTO refund (id, org_id, device_id, original_sale_id, origin, payload, receipt, session_id, created_at)
       VALUES ('${v7()}', '${org}', '${device}', '${saleId}', 'local', '{}', '{}', '${v7()}', '2026-01-01T00:00:00.000Z')`,
  );
  old.close();
  db = openTillDatabase(path);
  expect(await version(db)).toBe(tillMigrations.length);
  const kept = (table: string) =>
    db!.read((tx) => tx.all<{ shift_id: string | null }>(sql.raw(`SELECT shift_id FROM ${table}`)));
  expect(await kept("local_sale")).toEqual([{ shift_id: null }]);
  expect(await kept("refund")).toEqual([{ shift_id: null }]);
});

test("a drop needs a positive amount and a no-sale a zero amount with a reason", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-migrations-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  const shiftId = v7();
  await db.transaction((tx) =>
    tx.run(sql`INSERT INTO shift (id, org_id, device_id, branch_id, store_id, status, opened_at, opened_by, opened_session_id, float)
      VALUES (${shiftId}, ${org}, ${device}, ${v7()}, ${v7()}, 'open', '2026-01-01T00:00:00.000Z', ${v7()}, ${v7()}, 2000000)`),
  );
  const movement = (kind: string, amount: number, reason: string | null) =>
    db!.transaction((tx) =>
      tx.run(sql`INSERT INTO shift_movement (id, org_id, shift_id, kind, amount, reason, actor_id, session_id, at)
        VALUES (${v7()}, ${org}, ${shiftId}, ${kind}, ${amount}, ${reason}, ${v7()}, ${v7()}, '2026-01-01T01:00:00.000Z')`),
    );
  await movement("drop", 1_000_000, "Mid-shift drop");
  await movement("drop", 5_000, "Safe");
  await movement("no_sale", 0, "Change for a customer");
  await expect(movement("drop", 0, "Safe")).rejects.toThrow();
  await expect(movement("drop", -5_000, "Safe")).rejects.toThrow();
  await expect(movement("no_sale", 5_000, "Odd")).rejects.toThrow();
  await expect(movement("no_sale", 0, null)).rejects.toThrow();
  await expect(movement("no_sale", 0, "")).rejects.toThrow();
  await expect(movement("refund", 100, "Safe")).rejects.toThrow();
});
