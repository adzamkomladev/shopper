import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { localSale, outbox, reference, saleLine, tillAudit, tillState } from "@shopper/db-sqlite";
import { openTillDatabase, type TillDatabase } from "../../support/till/storage";

let directory: string;
let db: TillDatabase | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function openDatabase() {
  directory = await mkdtemp(join(tmpdir(), "shopper-till-driver-"));
  db = openTillDatabase(join(directory, "till.sqlite"));
  return db;
}

test("creates tenant UUID tables with WAL, foreign keys and full durability", async () => {
  const database = await openDatabase();
  expect([tillAudit, tillState, localSale, saleLine, outbox, reference]).toHaveLength(6);
  const tables = await database.read((tx) =>
    tx.all<{ name: string; sql: string }>(sql`
      SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN
      ('till_audit', 'till_state', 'local_sale', 'sale_line', 'outbox', 'reference')
    `),
  );
  expect(tables.map((row) => row.name).sort()).toEqual(
    ["local_sale", "outbox", "reference", "sale_line", "till_audit", "till_state"].sort(),
  );
  for (const { name, sql: definition } of tables) {
    expect(definition, `${name} uses UUID keys`).not.toMatch(/AUTOINCREMENT/i);
    expect(definition, `${name} includes tenant scope`).toMatch(/org_id/i);
  }
  const pragmas = await database.read(async (tx) => ({
    foreignKeys: await tx.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`),
    journal: await tx.all<{ journal_mode: string }>(sql`PRAGMA journal_mode`),
    synchronous: await tx.all<{ synchronous: number }>(sql`PRAGMA synchronous`),
  }));
  expect(pragmas).toEqual({
    foreignKeys: [{ foreign_keys: 1 }],
    journal: [{ journal_mode: "wal" }],
    synchronous: [{ synchronous: 2 }],
  });
});

test("a sale join preserves each table's ID and raw SQLite array positions", async () => {
  const database = await openDatabase();
  const orgId = v7();
  const deviceId = v7();
  const localId = v7();
  const saleId = v7();
  const outboxId = v7();
  await database.transaction(async (tx) => {
    await tx.insert(localSale).values({
      id: saleId,
      orgId,
      deviceId,
      localId,
      payload: { saleId },
      contentHash: "fixture-hash",
    });
    await tx.insert(outbox).values({
      id: outboxId,
      orgId,
      deviceId,
      localId,
      localSeq: 1,
      event: { saleId },
    });
  });
  const joined = await database.read((tx) =>
    tx
      .select({ saleId: localSale.id, outboxId: outbox.id })
      .from(localSale)
      .innerJoin(
        outbox,
        and(
          eq(outbox.orgId, localSale.orgId),
          eq(outbox.deviceId, localSale.deviceId),
          eq(outbox.localId, localSale.localId),
        ),
      ),
  );
  const rawValues = await database.read((tx) =>
    tx.values(sql`SELECT local_sale.id, outbox.id, outbox.local_seq FROM local_sale JOIN outbox
      ON outbox.org_id = local_sale.org_id AND outbox.device_id = local_sale.device_id
      AND outbox.local_id = local_sale.local_id`),
  );
  expect(joined).toEqual([{ saleId, outboxId }]);
  expect(rawValues).toEqual([[saleId, outboxId, 1]]);
});

test("a missing reference returns undefined and a present JSON reference stays typed", async () => {
  const database = await openDatabase();
  const missing = await database.read((tx) =>
    tx.select().from(reference).where(eq(reference.id, v7())).get(),
  );
  expect(missing).toBeUndefined();

  const orgId = v7();
  const referenceId = v7();
  await database.transaction((tx) =>
    tx.insert(reference).values({
      id: referenceId,
      orgId,
      entity: "product",
      payload: { sku: "MILK-001", archivedAt: null },
    }),
  );
  const found = await database.read((tx) =>
    tx.select().from(reference).where(eq(reference.id, referenceId)).get(),
  );
  expect(found).toMatchObject({ id: referenceId, payload: { sku: "MILK-001", archivedAt: null } });
});
