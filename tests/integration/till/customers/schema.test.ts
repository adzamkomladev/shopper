// Till SQLite step 9: the customer lookup, the customer upload outbox and the basket's customer.
// (The sale_draft_tender rebuild for account tenders belongs to the credit slice.)
import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { tillMigrations } from "@shopper/db-sqlite";
import { openTillDatabase, type TillDatabase } from "../../../support/till/storage";
import { Database } from "../../../support/till/sqlcipher";

let directory: string | undefined;
let db: TillDatabase | undefined;
afterEach(async () => {
  await db?.close();
  db = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
});

const org = v7();
const device = v7();
const columns = (database: TillDatabase, table: string) =>
  database
    .read((tx) =>
      tx.all<{ name: string }>(sql.raw(`SELECT name FROM pragma_table_info('${table}')`)),
    )
    .then((rows) => rows.map((row) => row.name));

test("step 9 adds customer_lookup, customer_upload and sale_draft.customer_id", async () => {
  expect(tillMigrations).toHaveLength(9);
  directory = await mkdtemp(join(tmpdir(), "shopper-till-customers-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  expect(await columns(db, "customer_lookup")).toEqual(
    expect.arrayContaining([
      "org_id",
      "customer_id",
      "name",
      "phone",
      "kind",
      "business_name",
      "tin",
      "version",
    ]),
  );
  // What the server keeps to itself never reaches the till.
  expect(await columns(db, "customer_lookup")).not.toEqual(expect.arrayContaining(["email"]));
  expect(await columns(db, "customer_lookup")).not.toContain("credit_limit");
  expect(await columns(db, "customer_upload")).toEqual(
    expect.arrayContaining([
      "id",
      "org_id",
      "device_id",
      "customer_id",
      "payload",
      "session_id",
      "attempts",
      "next_attempt_at",
      "blocked_code",
      "blocked_reason",
      "accepted_at",
    ]),
  );
  expect(await columns(db, "sale_draft")).toContain("customer_id");
  const indexes = await db.read((tx) =>
    tx.all<{ sql: string | null }>(
      sql`SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'customer_lookup' AND sql IS NOT NULL`,
    ),
  );
  expect(indexes.some((row) => /org_id\s*,\s*phone/.test(row.sql ?? ""))).toBe(true);
});

test("step 9 keeps existing drafts, now without a customer, and leaves the tender kinds alone", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-customers-"));
  const path = join(directory, "till.sqlite");
  const old = new Database(path);
  const draft = v7();
  for (const step of tillMigrations.slice(0, 8)) old.exec(step);
  old.exec(
    `PRAGMA user_version=8;
     INSERT INTO sale_draft (id, org_id, device_id, branch_id, cashier_id, revision, totals, created_at, updated_at)
       VALUES ('${draft}', '${org}', '${device}', '${v7()}', '${v7()}', 1, '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  old.close();

  db = openTillDatabase(path);
  expect(
    await db.read((tx) =>
      tx.all<{ customer_id: string | null }>(sql`SELECT customer_id FROM sale_draft`),
    ),
  ).toEqual([{ customer_id: null }]);
  const tenders = await db.read((tx) =>
    tx.all<{ sql: string }>(sql`SELECT sql FROM sqlite_master WHERE name = 'sale_draft_tender'`),
  );
  expect(tenders[0]!.sql).toContain("('cash','momo','card')");
});

test("a customer is looked up by phone through the index and one lookup row exists per customer", async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-customers-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  const id = v7();
  const insert = (customerId: string) =>
    db!.transaction((tx) =>
      tx.run(sql`INSERT INTO customer_lookup (org_id, customer_id, name, phone, kind, version)
        VALUES (${org}, ${customerId}, 'Ama Mensah', '0241234567', 'individual', 1)`),
    );
  await insert(id);
  await insert(v7());
  await expect(insert(id)).rejects.toThrow();
  const plan = await db.read((tx) =>
    tx.all<{ detail: string }>(
      sql`EXPLAIN QUERY PLAN SELECT customer_id FROM customer_lookup WHERE org_id = ${org} AND phone = '0241234567'`,
    ),
  );
  expect(plan.map((row) => row.detail).join(" ")).toMatch(/USING (COVERING )?INDEX/);
});
