import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
const context = provisioningContext();
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Redact integration" });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const secrets = {
  otp: "482913",
  id_number: "GHA-123456789-0",
  idNumber: "GHA-123456789-0",
  card_number: "4111111111111111",
  cardNumber: "4111111111111111",
};
const keep = { idMasked: "GHA-•••••••89-0", idType: "ghana_card", requestedLimit: 5_000_000 };
const record = defineCommand({
  name: "store.create",
  async run(tx, ctx, input: { name: string }) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: input.name })
      .returning();
    return { id: row!.id };
  },
  audit: (_input, output) => ({ storeId: output.id, ...secrets, ...keep, nested: { ...secrets } }),
  details: (_input, output) => ({
    entity: "store",
    entityId: output.id,
    before: { ...secrets, ...keep },
    after: { list: [{ ...secrets }], ...keep },
  }),
});

test("otp, id_number and card_number are masked in the payload, before and after, at any depth and in either casing", async () => {
  await record(db, context, { name: "Redacted" });
  const [row] = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq))
    .then((rows) => rows.filter((entry) => entry.command === "store.create"));
  const masked = Object.fromEntries(Object.keys(secrets).map((key) => [key, "[REDACTED]"]));
  expect(row!.payload).toMatchObject({ ...masked, ...keep, nested: masked });
  expect(row!.before).toEqual({ ...masked, ...keep });
  expect(row!.after).toEqual({ list: [masked], ...keep });
  const stored = JSON.stringify(row);
  for (const value of new Set(Object.values(secrets))) expect(stored).not.toContain(value);
});
