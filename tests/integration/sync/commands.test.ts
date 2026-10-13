import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
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
  await provisionOrg(db, context, { name: "Sync command replay" });
});

afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

test("an ordinary command replay returns persisted output without another mutation or audit", async () => {
  let runs = 0;
  const create = defineCommand({
    name: "sync.test.replay",
    async run(tx, ctx, input: { key: string }) {
      runs += 1;
      const [row] = await tx
        .insert(schema.store)
        .values({ orgId: ctx.orgId, name: input.key })
        .returning();
      if (!row) throw new Error("Expected created replay store");
      return { id: row.id };
    },
    async replay(tx, ctx, input) {
      const [row] = await tx
        .select()
        .from(schema.store)
        .where(and(eq(schema.store.orgId, ctx.orgId), eq(schema.store.name, input.key)));
      return row ? { output: { id: row.id } } : undefined;
    },
    audit: (input, output) => ({ key: input.key, storeId: output.id }),
  });
  const input = { key: `replay-${v7()}` };
  const first = await create(db, context, input);
  const before = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  const second = await create(db, context, input);
  const after = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  expect(second).toEqual(first);
  expect(runs).toBe(1);
  expect(after).toHaveLength(before.length);
  expect(after.at(-1)?.command).toBe("sync.test.replay");
});

test("workflow checkpoint replay still skips the command and its audit", async () => {
  let runs = 0;
  const create = defineCommand({
    name: "sync.test.checkpoint",
    async run(tx, ctx, input: { name: string }) {
      runs += 1;
      const [row] = await tx
        .insert(schema.store)
        .values({ orgId: ctx.orgId, name: input.name })
        .returning();
      if (!row) throw new Error("Expected created checkpoint store");
      return { id: row.id };
    },
    replay: async () => undefined,
    audit: (input) => ({ storeName: input.name }),
  });
  const checkpoint = {
    instanceId: v7(),
    businessKey: "",
    type: "sync",
    step: "accept",
    status: "running" as const,
  };
  checkpoint.businessKey = checkpoint.instanceId;
  const before = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  const first = await create(db, context, { name: "checkpoint" }, checkpoint);
  const second = await create(db, context, { name: "ignored retry" }, checkpoint);
  const after = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  expect(second).toEqual(first);
  expect(runs).toBe(1);
  expect(after).toHaveLength(before.length + 1);
});
