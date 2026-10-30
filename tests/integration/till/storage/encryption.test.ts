// Slice S1: the till SQLite is SQLCipher-encrypted when the host is given a key.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { TillDatabaseKeyError } from "@shopper/adapters-box";
import { startTillHost as startInProcess } from "@shopper/adapters-box/till";
import { projectProducts, searchCatalogue } from "@shopper/core/till";
import { ids, product, tempTill } from "../../../support/till/catalogue";
import { Database } from "../../../support/till/sqlcipher";
import { v7 } from "uuid";
import { e2eRun } from "../../../../tooling/e2e/run";
import { startTillHost } from "../../../support/till/host/process";
import { openTillDatabase } from "../../../support/till/storage";

const key = "ab".repeat(32);
const otherKey = "cd".repeat(32);
const hostEntry = join(process.cwd(), `apps/till/host/${e2eRun.outDir}/server.js`);
let till: Awaited<ReturnType<typeof tempTill>>;
let opened: typeof till | undefined;
// Only the database tests open a till; the host tests own their own directories.
afterEach(async () => {
  await opened?.close();
  opened = undefined;
});

test("a keyed till database has no plaintext SQLite header and cannot be opened without the key", async () => {
  till = opened = await tempTill(key);
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
  till = opened = await tempTill(key);
  await till.database.close();
  const before = await readFile(till.path);
  expect(() => openTillDatabase(till.path, otherKey)).toThrow(TillDatabaseKeyError);
  expect(() => openTillDatabase(till.path)).toThrow(TillDatabaseKeyError);
  expect(await readFile(till.path)).toEqual(before);
  await till.restart();
  const tables = await till.database.read((tx) =>
    tx.all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE name = 'till_state'`),
  );
  expect(tables).toHaveLength(1);
});

test("migrations, WAL and FTS5 product search work on an encrypted database", async () => {
  till = opened = await tempTill(key);
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

test("a register host given no key refuses to start rather than keep sales in a plain file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-keyless-"));
  const sqlitePath = join(directory, "till.sqlite");
  const keyless = {
    sqlitePath,
    upstream: "http://127.0.0.1:1",
    origins: ["http://127.0.0.1:1"],
    port: 0,
    identity: {
      orgId: v7(),
      deviceId: v7(),
      storeId: v7(),
      branchId: v7(),
      shopName: "Keyless shop",
      registerName: "Register 1",
    },
    deviceToken: "ef".repeat(32),
    session: null,
  };
  try {
    // Refused at the configuration boundary, before any file is opened.
    await expect(startInProcess(keyless, () => undefined)).rejects.toThrow(/databaseKey/);
    expect(existsSync(sqlitePath)).toBe(false);
    // Development and tests opt out by name; a packaged register always has a sealed key.
    const host = await startTillHost({ ...keyless, plaintext: true });
    await host.stop();
    expect((await readFile(sqlitePath)).subarray(0, 15).toString()).toBe("SQLite format 3");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a standalone install with no key is refused before it serves enrolment and spends a code", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-keyless-install-"));
  const path = join(directory, "register.json");
  const install = { sqlitePath: join(directory, "till.sqlite"), upstream: "http://127.0.0.1:1" };
  await writeFile(path, JSON.stringify({ ...install, origins: ["http://127.0.0.1:1"], port: 0 }));
  try {
    // No IPC parent: the host reads the file itself and answers on stdout.
    const run = spawnSync(process.execPath, [hostEntry, path], {
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("databaseKey");
    expect(run.stdout).not.toContain('"unenrolled"');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
