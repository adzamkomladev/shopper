// Slice S1: the till SQLite is SQLCipher-encrypted when the host is given a key.
import { readFile } from "node:fs/promises";
import { afterEach, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { TillDatabaseKeyError } from "@shopper/adapters-box";
import { projectProducts, searchCatalogue } from "@shopper/core/till";
import { ids, product, tempTill } from "../../../support/till/catalogue";
import { Database } from "../../../support/till/sqlcipher";
import { openTillDatabase } from "../../../support/till/storage";

const key = "ab".repeat(32);
const otherKey = "cd".repeat(32);
let till: Awaited<ReturnType<typeof tempTill>>;
afterEach(() => till.close());

test("a keyed till database has no plaintext SQLite header and cannot be opened without the key", async () => {
  till = await tempTill(key);
  await till.restart();
  const header = (await readFile(till.path)).subarray(0, 16).toString("latin1");
  expect(header).not.toContain("SQLite format 3");
  const plain = new Database(till.path);
  expect(() => plain.prepare("SELECT count(*) FROM sqlite_master").get()).toThrow(
    /not a database/i,
  );
  plain.close();
});

test("the wrong key is refused and the file is left intact", async () => {
  till = await tempTill(key);
  await till.database.close();
  const before = await readFile(till.path);
  expect(() => openTillDatabase(till.path, otherKey)).toThrow(TillDatabaseKeyError);
  expect(() => openTillDatabase(till.path)).toThrow();
  expect(await readFile(till.path)).toEqual(before);
  await till.restart();
  const tables = await till.database.read((tx) =>
    tx.all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE name = 'till_state'`),
  );
  expect(tables).toHaveLength(1);
});

test("migrations, WAL and FTS5 product search work on an encrypted database", async () => {
  till = await tempTill(key);
  const milk = product({ name: "Fresh Milk" });
  await till.database.transaction((tx) => projectProducts(tx, ids.org, [milk, product()]));
  await till.restart();
  const pragmas = await till.database.read((tx) =>
    tx.all<{ journal_mode: string; user_version: number }>(
      sql`SELECT j.journal_mode, v.user_version FROM pragma_journal_mode j, pragma_user_version v`,
    ),
  );
  expect(pragmas[0]).toMatchObject({ journal_mode: "wal" });
  expect(pragmas[0].user_version).toBeGreaterThan(0);
  const found = await searchCatalogue(till.database, { orgId: ids.org, query: "milk" });
  expect(found.map((row) => row.productId)).toEqual([milk.id]);
});
