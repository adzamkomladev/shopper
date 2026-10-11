import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand, verifyChain } from "@shopper/audit";
import { migrateDatabase } from "../../../tooling/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/seed";
import { postgresFixture } from "../../fixtures/postgres";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
const context = provisioningContext();
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Audit integration" });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});
const create = defineCommand({
  name: "store.create",
  async run(tx, ctx, input: { name: string; pin?: string; metadata?: Record<string, unknown> }) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: input.name })
      .returning();
    return { id: row!.id, name: row!.name };
  },
  audit: (input, output) => ({ ...input, storeId: output.id }),
  details: (_input, output) => ({
    entity: "store",
    entityId: output.id,
    before: null,
    after: output,
  }),
});
const entries = () =>
  db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));
test("concurrent commands chain without forks; metadata, redaction, exact tamper ID and anchors survive PG storage", async () => {
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      create(db, context, {
        name: `Store ${i}`,
        pin: "1234",
        metadata: { shippingAddress: "Keep this", nested: { apiKey: "Remove this" } },
      }),
    ),
  );
  const rows = await entries();
  expect(await verifyChain(rows)).toMatchObject({ valid: true, count: 11 });
  expect(rows[1]!.payload.pin).toBe("[REDACTED]");
  expect(rows[1]!.payload.metadata).toEqual({
    shippingAddress: "Keep this",
    nested: { apiKey: "[REDACTED]" },
  });
  const altered = rows.map((row) => ({ ...row }));
  altered[4]!.payload = { name: "Tampered" };
  expect(await verifyChain(altered)).toEqual({
    valid: false,
    entryId: altered[4]!.id,
    reason: "hash",
  });
  expect(await verifyChain(rows.slice(0, -1), rows.at(-1)!.hash!)).toMatchObject({
    valid: false,
    reason: "anchor",
  });
  await expect(
    db
      .update(schema.auditLog)
      .set({ command: "tamper" })
      .where(eq(schema.auditLog.id, rows[0]!.id)),
  ).rejects.toThrow();
  await expect(db.delete(schema.auditLog)).rejects.toThrow();
  await expect(fixture.client.query("TRUNCATE audit_log")).rejects.toThrow(/append-only/);
});
test("audit failure rolls back business mutation and workflow checkpoint; retries replay committed JSON results", async () => {
  const checkpoint = {
    instanceId: v7(),
    businessKey: "",
    type: "onboarding",
    step: "store",
    status: "running" as const,
  };
  checkpoint.businessKey = checkpoint.instanceId;
  const before = await db.select().from(schema.store);
  await expect(
    create(db, { ...context, actorId: v7() }, { name: "Must roll back" }, checkpoint),
  ).rejects.toThrow();
  expect(await db.select().from(schema.store)).toEqual(before);
  expect(await db.select().from(schema.workflowRun)).toHaveLength(0);
  const [first, second] = await Promise.all([
    create(db, context, { name: "Once" }, checkpoint),
    create(db, context, { name: "Once" }, checkpoint),
  ]);
  expect(first).toEqual(second);
  expect(await db.select().from(schema.store)).toHaveLength(before.length + 1);
  expect(await db.select().from(schema.workflowStep)).toHaveLength(1);
  const [run] = await db.select().from(schema.workflowRun);
  expect(run).toMatchObject({
    instanceId: checkpoint.instanceId,
    currentStep: "store",
    status: "running",
  });
  await expect(
    create(db, context, { name: "Wrong type" }, { ...checkpoint, type: "payment" }),
  ).rejects.toThrow(/another type/);
  expect(await verifyChain(await entries())).toMatchObject({ valid: true });
});
test("trusted actor, approver, branch and device context is stored and included in the hash", async () => {
  const setup = defineCommand({
    name: "fixture.audit-context",
    async run(tx, ctx) {
      const [actor] = await tx
        .insert(schema.user)
        .values({ orgId: ctx.orgId, name: "Manager", email: "audit@example.test" })
        .returning();
      const [store] = await tx
        .insert(schema.store)
        .values({ orgId: ctx.orgId, name: "Context" })
        .returning();
      const [branch] = await tx
        .insert(schema.branch)
        .values({ orgId: ctx.orgId, storeId: store!.id, name: "Main" })
        .returning();
      const [device] = await tx
        .insert(schema.device)
        .values({ orgId: ctx.orgId, branchId: branch!.id, name: "Till" })
        .returning();
      return { actor: actor!, branch: branch!, device: device! };
    },
    audit: (_input, output) => ({
      actorId: output.actor.id,
      branchId: output.branch.id,
      deviceId: output.device.id,
    }),
  });
  const { actor, branch, device } = await setup(db, context, undefined);
  const deviceTime = new Date("2026-10-07T12:34:56.000Z");
  await create(
    db,
    {
      ...context,
      actorId: actor!.id.toUpperCase(),
      approverId: actor!.id.toUpperCase(),
      orgId: context.orgId.toUpperCase(),
      role: "manager",
      branchId: branch!.id,
      deviceId: device!.id,
      reason: "Approved correction",
      deviceTime,
    },
    { name: "Metadata" },
  );
  const rows = await entries();
  expect(rows.at(-1)).toMatchObject({
    actorId: actor!.id,
    approverId: actor!.id,
    role: "manager",
    deviceTime,
    entity: "store",
  });
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("a forward migration preserves legacy audit rows and reports their unhashed boundary", async () => {
  const { readFile } = await import("node:fs/promises");
  const legacy = await postgresFixture();
  try {
    for (const name of ["0000_schema_v1.sql", "0001_timestamps_and_audit.sql"]) {
      const sql = await readFile(
        new URL(`../../../packages/db-pg/migrations/${name}`, import.meta.url),
        "utf8",
      );
      for (const statement of sql.split("--> statement-breakpoint"))
        await legacy.client.query(statement);
    }
    const ctx = provisioningContext();
    await legacy.client.query("INSERT INTO org (id,name) VALUES ($1,'Legacy')", [ctx.orgId]);
    const old = await legacy.client.query(
      "INSERT INTO audit_log (org_id,command,app_version,payload) VALUES ($1,'legacy.provision',$2,'{}') RETURNING id",
      [ctx.orgId, ctx.appVersion],
    );
    const forward = await readFile(
      new URL("../../../packages/db-pg/migrations/0002_audit_and_workflows.sql", import.meta.url),
      "utf8",
    );
    for (const statement of forward.split("--> statement-breakpoint"))
      await legacy.client.query(statement);
    const legacyDb = drizzle(legacy.client, { schema });
    await create(legacyDb, ctx, { name: "After migration" });
    const rows = await legacyDb.select().from(schema.auditLog).orderBy(schema.auditLog.createdAt);
    expect(await verifyChain(rows)).toEqual({
      valid: false,
      entryId: old.rows[0].id,
      reason: "legacy-unhashed",
    });
    expect(await verifyChain(rows.slice(1))).toMatchObject({ valid: true, count: 1 });
    await expect(
      legacy.client.query(
        "INSERT INTO audit_log (org_id,command,app_version,payload) VALUES ($1,'unhashed',$2,'{}')",
        [ctx.orgId, ctx.appVersion],
      ),
    ).rejects.toThrow(/require a hash chain/);
  } finally {
    await legacy.close();
  }
});
