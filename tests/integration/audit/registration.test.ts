import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand, hashEntry, verifyChain } from "@shopper/audit";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await migrateDatabase(db);
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const requestShape = {
  email: "owner@example.test",
  name: "Ama Owner",
  shopName: "Ama Mart",
  shopCode: "ama-mart",
};
const createRequest = defineCommand({
  name: "registration.request",
  scope: "registration",
  async run(tx, ctx, _input: typeof requestShape & { token: string; fail?: boolean }) {
    await tx.insert(schema.registrationRequest).values({
      id: ctx.orgId,
      ...requestShape,
      verificationDigest: "a".repeat(64),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    return { id: ctx.orgId };
  },
  audit: (input, output) => {
    if (input.fail) throw new Error("audit failed");
    return { ...input, requestId: output.id };
  },
  details: (_input, output) => ({ entity: "registration_request", entityId: output.id }),
});
const complete = defineCommand({
  name: "registration.complete",
  scope: "registration",
  async run(tx, ctx) {
    await tx
      .update(schema.registrationRequest)
      .set({ completedAt: new Date(), result: { orgId: ctx.orgId } })
      .where(eq(schema.registrationRequest.id, ctx.orgId));
    return { orgId: ctx.orgId };
  },
  audit: (_input, output) => output,
});
const tenantStore = defineCommand({
  name: "store.create",
  async run(tx, ctx, input: { name: string }) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: input.name })
      .returning();
    return { id: row!.id };
  },
  audit: (input) => input,
});
const input = { ...requestShape, token: "raw-token-value" };
const trusted = (orgId = v7()) => provisioningContext(orgId);
const audit = (orgId: string) =>
  db
    .select()
    .from(schema.registrationAuditLog)
    .where(eq(schema.registrationAuditLog.orgId, orgId))
    .orderBy(asc(schema.registrationAuditLog.chainSeq));
const requests = (orgId: string) =>
  db.select().from(schema.registrationRequest).where(eq(schema.registrationRequest.id, orgId));

test("a registration command audits a candidate that has no customer org, and the chain verifies", async () => {
  const ctx = trusted();
  await createRequest(db, ctx, input);
  await complete(db, ctx, undefined);
  expect(await db.select().from(schema.org).where(eq(schema.org.id, ctx.orgId))).toHaveLength(0);
  const rows = await audit(ctx.orgId);
  expect(await verifyChain(rows)).toMatchObject({ valid: true, count: 2 });
  expect(rows[0]).toMatchObject({
    command: "registration.request",
    entity: "registration_request",
  });
  expect(rows[0]!.payload.token).toBe("[REDACTED]");
  expect(JSON.stringify(rows)).not.toContain("raw-token-value");
  const [saved] = await requests(ctx.orgId);
  expect(saved).toMatchObject({ orgId: ctx.orgId, id: ctx.orgId, shopCode: "ama-mart" });
  expect(saved!.completedAt).toBeInstanceOf(Date);
  expect(
    await db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, ctx.orgId)),
  ).toHaveLength(0);
});

test("concurrent checkpoint replays create one request and one workflow step without secrets", async () => {
  const ctx = trusted();
  const checkpoint = {
    instanceId: ctx.orgId,
    businessKey: ctx.orgId,
    type: "registration",
    step: "request",
    status: "waiting" as const,
  };
  const [a, b] = await Promise.all([
    createRequest(db, ctx, input, checkpoint),
    createRequest(db, ctx, input, checkpoint),
  ]);
  expect(a).toEqual(b);
  expect(await requests(ctx.orgId)).toHaveLength(1);
  const steps = await db
    .select()
    .from(schema.registrationWorkflowStep)
    .where(eq(schema.registrationWorkflowStep.orgId, ctx.orgId));
  expect(steps).toHaveLength(1);
  const [run] = await db
    .select()
    .from(schema.registrationWorkflowRun)
    .where(eq(schema.registrationWorkflowRun.orgId, ctx.orgId));
  expect(run).toMatchObject({ currentStep: "request", status: "waiting", type: "registration" });
  expect(await audit(ctx.orgId)).toHaveLength(1);
  expect(JSON.stringify([steps, await audit(ctx.orgId)])).not.toContain("raw-token-value");
  await expect(createRequest(db, ctx, input, { ...checkpoint, type: "payment" })).rejects.toThrow(
    /another type/,
  );
});

test("registration scope rejects customer identity, device, role, approver and branch context", async () => {
  for (const extra of [
    { actorId: v7() },
    { deviceId: v7() },
    { branchId: v7() },
    { approverId: v7() },
    { role: "owner" },
    { reason: "because" },
    { deviceTime: new Date() },
  ]) {
    const ctx = { ...trusted(), ...extra };
    await expect(createRequest(db, ctx, input)).rejects.toThrow();
    expect(await requests(ctx.orgId)).toHaveLength(0);
    expect(await audit(ctx.orgId)).toHaveLength(0);
  }
});

test("an audit failure removes the request, audit row and checkpoint", async () => {
  const ctx = trusted();
  const checkpoint = {
    instanceId: ctx.orgId,
    businessKey: ctx.orgId,
    type: "registration",
    step: "request",
    status: "waiting" as const,
  };
  await expect(createRequest(db, ctx, { ...input, fail: true }, checkpoint)).rejects.toThrow(
    /audit failed/,
  );
  expect(await requests(ctx.orgId)).toHaveLength(0);
  expect(await audit(ctx.orgId)).toHaveLength(0);
  const runs = await db
    .select()
    .from(schema.registrationWorkflowRun)
    .where(eq(schema.registrationWorkflowRun.orgId, ctx.orgId));
  expect(runs).toHaveLength(0);
});

test("registration completion and tenant provisioning commit atomically in one outer transaction", async () => {
  const ctx = trusted();
  await createRequest(db, ctx, input);
  await db.transaction(async (tx) => {
    await complete(tx, ctx, undefined);
    await provisionOrg(tx, ctx, { name: "Ama Mart", slug: "ama-mart" });
    await tenantStore(tx, ctx, { name: "Main" });
  });
  expect(await verifyChain(await audit(ctx.orgId))).toMatchObject({ valid: true, count: 2 });
  const tenantRows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, ctx.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));
  expect(await verifyChain(tenantRows)).toMatchObject({ valid: true, count: 2 });

  const failed = trusted();
  await createRequest(db, failed, input);
  await expect(
    db.transaction(async (tx) => {
      await complete(tx, failed, undefined);
      await provisionOrg(tx, failed, { name: "Rolled back" });
      throw new Error("later step failed");
    }),
  ).rejects.toThrow(/later step/);
  const [pending] = await requests(failed.orgId);
  expect(pending!.completedAt).toBeNull();
  expect(await db.select().from(schema.org).where(eq(schema.org.id, failed.orgId))).toHaveLength(0);
  expect(await audit(failed.orgId)).toHaveLength(1);
});

test("the customer audit hash projection is unchanged", async () => {
  const entry = {
    id: "01990000-0000-7000-8000-000000000001",
    orgId: "01990000-0000-7000-8000-000000000002",
    actorId: null,
    role: "owner",
    deviceId: null,
    branchId: null,
    approverId: null,
    reason: null,
    deviceTime: null,
    entity: "store",
    entityId: null,
    before: null,
    after: { name: "Main" },
    appVersion: "1.0.0",
    command: "store.create",
    payload: { name: "Main" },
    chainSeq: 1,
    prevHash: "0".repeat(64),
    hash: null,
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
  };
  expect(await hashEntry(entry)).toBe(
    "7b97b921878e959ea97697465d9103dc25f5b6e0fd141437c8e24e4b7cc8fc74",
  );
});

test("registration history is append-only and the migration is idempotent", async () => {
  const ctx = trusted();
  await createRequest(db, ctx, input);
  await expect(
    db
      .update(schema.registrationAuditLog)
      .set({ command: "tamper" })
      .where(eq(schema.registrationAuditLog.orgId, ctx.orgId)),
  ).rejects.toThrow();
  await expect(fixture.client.query("TRUNCATE registration_audit_log")).rejects.toThrow(
    /append-only/,
  );
});
