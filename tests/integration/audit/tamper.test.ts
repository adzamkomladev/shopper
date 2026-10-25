// A chain row edited, removed or cut off behind an anchor directly in the database is named by the verifier, and
// the history tables refuse deletes so a six-year record cannot be pruned by the application.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { auditStreams, verifyStream } from "@shopper/core/audit";
import { v7 } from "uuid";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
const context = provisioningContext();

const createStore = defineCommand({
  name: "store.create",
  async run(tx, ctx, input: { name: string }) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: input.name })
      .returning();
    return { id: row!.id, name: row!.name };
  },
  audit: (_input, output) => ({ storeId: output.id }),
  details: (_input, output) => ({
    entity: "store",
    entityId: output.id,
    before: null,
    after: output,
  }),
});

const chain = () =>
  db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));

/** Runs raw SQL with the history triggers off, as someone with database access would. */
const tamper = async (text: string, values: unknown[] = []) => {
  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = replica");
    await client.query(text, values);
  } finally {
    await client.query("RESET session_replication_role");
    client.release();
  }
};

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Tamper org" });
  for (let i = 0; i < 6; i++) await createStore(db, context, { name: `Store ${i}` });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

test("an untouched org chain passes with its count and head", async () => {
  const rows = await chain();
  expect(await verifyStream(db, context.orgId, "org", { pageSize: 4 })).toEqual({
    valid: true,
    count: rows.length,
    head: { seq: rows.at(-1)!.chainSeq, hash: rows.at(-1)!.hash },
  });
});

test("an edited row is flagged by its own id, even across verification pages", async () => {
  const target = (await chain())[4]!;
  await tamper(`UPDATE audit_log SET after = '{"name":"Forged"}' WHERE id = $1`, [target.id]);
  expect(await verifyStream(db, context.orgId, "org", { pageSize: 2 })).toEqual({
    valid: false,
    entryId: target.id,
    seq: target.chainSeq,
    reason: "hash",
  });
  await tamper(`UPDATE audit_log SET after = $2 WHERE id = $1`, [target.id, target.after]);
  expect(await verifyStream(db, context.orgId, "org")).toMatchObject({ valid: true });
});

test("a removed middle row is flagged at the row that follows the gap", async () => {
  const rows = await chain();
  const removed = rows[2]!;
  await tamper(`DELETE FROM audit_log WHERE id = $1`, [removed.id]);
  expect(await verifyStream(db, context.orgId, "org")).toEqual({
    valid: false,
    entryId: rows[3]!.id,
    seq: rows[3]!.chainSeq,
    reason: "sequence",
  });
  await tamper(
    `INSERT INTO audit_log SELECT * FROM json_populate_record(NULL::audit_log, $1::json)`,
    [JSON.stringify(rowJson(removed))],
  );
  expect(await verifyStream(db, context.orgId, "org")).toMatchObject({ valid: true });
});

test("a tail cut off behind an anchor fails on the anchor", async () => {
  const rows = await chain();
  const head = rows.at(-1)!;
  await db.insert(schema.auditAnchor).values({
    orgId: context.orgId,
    day: "2026-10-25",
    stream: "org",
    chainSeq: head.chainSeq!,
    hash: head.hash!,
  });
  expect(await verifyStream(db, context.orgId, "org")).toMatchObject({ valid: true });
  await tamper(`DELETE FROM audit_log WHERE id = $1`, [head.id]);
  expect(await verifyStream(db, context.orgId, "org")).toEqual({
    valid: false,
    entryId: rows.at(-2)!.id,
    seq: rows.at(-2)!.chainSeq,
    reason: "anchor",
  });
});

test("a register whose every uploaded row was deleted is still listed through its anchors, and fails", async () => {
  const register = v7();
  await db.insert(schema.auditAnchor).values({
    orgId: context.orgId,
    day: "2026-10-24",
    stream: register,
    chainSeq: 4,
    hash: "a".repeat(64),
  });
  expect((await auditStreams(db, context.orgId)).find((s) => s.stream === register)).toMatchObject({
    count: 0,
    head: null,
    anchor: { day: "2026-10-24", seq: 4 },
  });
  expect(await verifyStream(db, context.orgId, register)).toMatchObject({
    valid: false,
    reason: "anchor",
  });
});

test("anchors are held to every published hash, including the empty chain's genesis", async () => {
  const rows = await chain();
  const anchor = (day: string, chainSeq: number, hash: string) =>
    db
      .insert(schema.auditAnchor)
      .values({ orgId: context.orgId, day, stream: "org", chainSeq, hash });
  await anchor("2026-10-20", rows[1]!.chainSeq!, rows[1]!.hash!);
  await anchor("2026-10-21", rows[1]!.chainSeq!, "f".repeat(64));
  expect(await verifyStream(db, context.orgId, "org")).toMatchObject({
    valid: false,
    entryId: rows[1]!.id,
    reason: "anchor",
  });
  const other = provisioningContext();
  await provisionOrg(db, other, { name: "Empty anchor org" });
  await db.insert(schema.auditAnchor).values({
    orgId: other.orgId,
    day: "2026-10-20",
    stream: "device-less",
    chainSeq: 0,
    hash: "e".repeat(64),
  });
  expect(await verifyStream(db, other.orgId, "device-less")).toEqual({
    valid: false,
    entryId: null,
    seq: 0,
    reason: "anchor",
  });
});

test("history tables refuse deletes and truncation (retention)", async () => {
  // Row triggers only fire on rows, so deletes are tried where rows exist; truncation is refused regardless.
  for (const statement of [
    "DELETE FROM audit_log",
    "DELETE FROM audit_anchor",
    "TRUNCATE audit_log",
    "TRUNCATE device_audit",
    "TRUNCATE audit_anchor",
  ])
    await expect(pool.query(statement), statement).rejects.toThrow();
});

const rowJson = (row: typeof schema.auditLog.$inferSelect) => ({
  id: row.id,
  org_id: row.orgId,
  created_at: row.createdAt.toISOString(),
  updated_at: row.updatedAt.toISOString(),
  command: row.command,
  role: row.role,
  device_id: row.deviceId,
  branch_id: row.branchId,
  entity: row.entity,
  entity_id: row.entityId,
  before: row.before,
  after: row.after,
  reason: row.reason,
  approver_id: row.approverId,
  device_time: row.deviceTime?.toISOString() ?? null,
  chain_seq: row.chainSeq,
  prev_hash: row.prevHash,
  hash: row.hash,
  actor_id: row.actorId,
  app_version: row.appVersion,
  payload: row.payload,
});
