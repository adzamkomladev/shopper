import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { tillAudit } from "@shopper/db-sqlite";
import {
  openTillDatabase,
  sqliteDefineCommand,
  type CommandContext,
  type TillDatabase,
  type TillSqlite,
} from "../../support/till/storage";

let folder: string;
let path: string;
let database: TillDatabase | undefined;
const context: CommandContext = { orgId: v7(), actorId: v7(), appVersion: "test-build" };

afterEach(async () => {
  await database?.close();
  database = undefined;
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function openDatabase() {
  folder = await mkdtemp(join(tmpdir(), "shopper-till-storage-"));
  path = join(folder, "till.sqlite");
  database = openTillDatabase(path);
  return database;
}

async function insertSale(tx: TillSqlite, orgId: string, deviceId: string, localId: string) {
  await tx.run(sql`
    INSERT INTO local_sale (id, org_id, device_id, local_id, payload, content_hash)
    VALUES (${v7()}, ${orgId}, ${deviceId}, ${localId}, '{"v":1}', 'fixture-hash')
  `);
}

test("committed local state and outbox rows survive closing and reopening the file", async () => {
  let db = await openDatabase();
  const orgId = v7();
  const deviceId = v7();
  const id = v7();
  const localId = v7();
  await db.transaction(async (tx) => {
    await tx.run(sql`
      INSERT INTO till_state (id, org_id, device_id, last_outbox_seq)
      VALUES (${v7()}, ${orgId}, ${deviceId}, 9)
    `);
    await insertSale(tx, orgId, deviceId, localId);
    await tx.run(sql`
      INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
      VALUES (${id}, ${orgId}, ${deviceId}, ${localId}, 9, '{"v":1}', 0, 0, NULL)
    `);
  });
  await db.close();
  database = undefined;
  db = openTillDatabase(path);
  database = db;
  const saved = await db.read((tx) =>
    tx.all<{ id: string; localSeq: number }>(sql`
      SELECT id, local_seq AS localSeq FROM outbox WHERE id = ${id}
    `),
  );
  expect(saved).toEqual([{ id, localSeq: 9 }]);
  expect(saved[0]?.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("a failed local write or audit leaves neither business rows nor a forked chain", async () => {
  const db = await openDatabase();
  const deviceId = context.deviceId ?? v7();
  const failAfterWrite = sqliteDefineCommand({
    name: "test.fail-after-write",
    async run(tx) {
      await insertSale(tx, context.orgId, deviceId, v7());
      await tx.run(sql`INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
        SELECT ${v7()}, ${context.orgId}, ${deviceId}, local_id, 1, '{"v":1}', 0, 0, NULL FROM local_sale WHERE org_id = ${context.orgId} ORDER BY rowid DESC LIMIT 1`);
      throw new Error("injected write failure");
    },
    audit: () => ({}),
  });
  await expect(failAfterWrite(db, context, undefined)).rejects.toThrow("injected write failure");

  const failAudit = sqliteDefineCommand({
    name: "test.fail-audit",
    async run(tx) {
      await insertSale(tx, context.orgId, deviceId, v7());
      await tx.run(sql`INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
        SELECT ${v7()}, ${context.orgId}, ${deviceId}, local_id, 1, '{"v":1}', 0, 0, NULL FROM local_sale WHERE org_id = ${context.orgId} ORDER BY rowid DESC LIMIT 1`);
      return "written";
    },
    audit: () => ({ invalid: 1n }),
  });
  await expect(failAudit(db, context, undefined)).rejects.toThrow();
  const counts = await db.read(async (tx) => ({
    outbox: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM outbox`),
    audit: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM till_audit`),
  }));
  expect(counts).toEqual({ outbox: [{ count: 0 }], audit: [{ count: 0 }] });
});

test("concurrent commands serialize writes and form one verifiable audit chain", async () => {
  const db = await openDatabase();
  const deviceId = v7();
  const create = sqliteDefineCommand({
    name: "test.concurrent-local-write",
    async run(tx, ctx, input: { localId: string; seq: number }) {
      await insertSale(tx, ctx.orgId, deviceId, input.localId);
      await tx.run(sql`INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
        SELECT ${v7()}, ${ctx.orgId}, ${deviceId}, local_id, ${input.seq}, '{"v":1}', 0, 0, NULL FROM local_sale WHERE org_id = ${ctx.orgId} AND local_id = ${input.localId}`);
      await new Promise((resolve) => setTimeout(resolve, 2));
      return input.localId;
    },
    audit: (_input, output) => ({ localId: output }),
    details: (_input, output) => ({ entity: "outbox", entityId: output }),
  });
  const localIds = Array.from({ length: 8 }, () => v7());
  await Promise.all(
    localIds.map((localId, index) => create(db, context, { localId, seq: index + 1 })),
  );
  const saved = await db.read((tx) =>
    tx.all<{ localId: string }>(sql`SELECT local_id AS localId FROM outbox`),
  );
  const auditRows = (await db.read((tx) => tx.select().from(tillAudit))) as AuditEntry[];
  expect(saved.map((row) => row.localId).sort()).toEqual(localIds.sort());
  expect(await verifyChain(auditRows)).toMatchObject({ valid: true, count: 8 });
});

test("replay returns the saved output without another mutation or audit row", async () => {
  const db = await openDatabase();
  const deviceId = v7();
  let runs = 0;
  const record = sqliteDefineCommand({
    name: "test.replay-local-write",
    async run(tx, ctx, input: { localId: string }) {
      runs += 1;
      await insertSale(tx, ctx.orgId, deviceId, input.localId);
      await tx.run(sql`INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
        SELECT ${v7()}, ${ctx.orgId}, ${deviceId}, local_id, 1, '{"v":1}', 0, 0, NULL FROM local_sale WHERE org_id = ${ctx.orgId} AND local_id = ${input.localId}`);
      return { id: input.localId };
    },
    async replay(tx, ctx, input) {
      const [row] = await tx.all<{ localId: string }>(sql`
        SELECT local_id AS localId FROM outbox WHERE org_id = ${ctx.orgId} AND local_id = ${input.localId}
      `);
      return row ? { output: { id: row.localId } } : undefined;
    },
    audit: (_input, output) => ({ localId: output.id }),
  });
  const input = { localId: v7() };
  const first = await record(db, context, input);
  const before = await db.read(async (tx) => ({
    outbox: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM outbox`),
    audit: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM till_audit`),
  }));
  const replayed = await record(db, context, input);
  const after = await db.read(async (tx) => ({
    outbox: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM outbox`),
    audit: await tx.all<{ count: number }>(sql`SELECT count(*) AS count FROM till_audit`),
  }));
  expect(first).toEqual(replayed);
  expect(runs).toBe(1);
  expect(after).toEqual(before);
});

test("acknowledging an upload is audited and keeps the local sale", async () => {
  const db = await openDatabase();
  const deviceId = context.deviceId ?? v7();
  const localId = v7();
  await db.transaction(async (tx) => {
    await insertSale(tx, context.orgId, deviceId, localId);
    await tx.run(sql`INSERT INTO outbox (id, org_id, device_id, local_id, local_seq, event, attempts, next_attempt_at, blocked_reason)
      SELECT ${v7()}, ${context.orgId}, ${deviceId}, local_id, 1, '{"v":1}', 0, 0, NULL FROM local_sale WHERE org_id = ${context.orgId} AND local_id = ${localId}`);
  });
  const acknowledge = sqliteDefineCommand({
    name: "sync.acknowledge",
    async run(tx, ctx, input: { localId: string }) {
      await tx.run(
        sql`DELETE FROM outbox WHERE org_id = ${ctx.orgId} AND local_id = ${input.localId}`,
      );
      return input.localId;
    },
    audit: (_input, output) => ({ localId: output }),
    details: (_input, output) => ({ entity: "sale", entityId: output }),
  });
  await acknowledge(db, context, { localId });
  const state = await db.read(async (tx) => ({
    sales: await tx.all<{ count: number }>(
      sql`SELECT count(*) AS count FROM local_sale WHERE local_id = ${localId}`,
    ),
    outbox: await tx.all<{ count: number }>(
      sql`SELECT count(*) AS count FROM outbox WHERE local_id = ${localId}`,
    ),
    audit: await tx.all<{ command: string; orgId: string }>(
      sql`SELECT command, org_id AS orgId FROM till_audit`,
    ),
  }));
  expect(state).toEqual({
    sales: [{ count: 1 }],
    outbox: [{ count: 0 }],
    audit: [{ command: "sync.acknowledge", orgId: context.orgId }],
  });
});
