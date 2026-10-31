// The audit log is append-only and hash-chained: what goes in can never be taken out. Phones, TINs and Ghana Card
// numbers are written there as their last four only; the record tables keep the full values.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand, verifyChain } from "@shopper/audit";
import { createCustomer } from "@shopper/core/customers";
import { setTaxSettings } from "@shopper/core/tax";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
const context = provisioningContext();
// A system actor: no user row, as provisioning runs.
const actor = { ...context, role: "superadmin" };
const PHONE = "0244987654";
const TIN = "C0012345678";
const CARD = "GHA-123456789-0";

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "PII review" });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const entries = () =>
  db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));

test("a customer's phone and TIN reach the audit log as their last four; the customer keeps them whole", async () => {
  const customer = await createCustomer(db, actor, {
    customer: {
      id: v7(),
      name: "Canary Traders",
      phone: PHONE,
      kind: "business",
      businessName: "Canary Traders Ltd",
      tin: TIN,
    },
  });
  await setTaxSettings(db, actor, {
    body: {
      tin: TIN,
      vatRegisteredFrom: "2026-01-01",
      priceMode: "inclusive",
      cashRounding: "10p",
    },
  });
  const logged = JSON.stringify(await entries());
  expect(logged).not.toContain(PHONE);
  expect(logged).not.toContain(TIN);
  expect(logged).toContain("7654");
  expect(logged).toContain("5678");
  const [saved] = await db
    .select()
    .from(schema.customer)
    .where(eq(schema.customer.id, customer.id));
  expect(saved).toMatchObject({ phone: PHONE, tin: TIN });
  expect(await verifyChain(await entries())).toMatchObject({ valid: true });
});

test("every spelling of a phone, TIN or Ghana Card is masked wherever it sits in a payload", async () => {
  const probe = defineCommand({
    name: "pii.probe",
    run: async (_tx, _ctx, input: Record<string, unknown>) => input,
    audit: (input) => input,
    details: (input) => ({ entity: "org", before: null, after: input }),
  });
  await probe(db, actor, {
    phone: PHONE,
    customerPhone: PHONE,
    momoNumber: PHONE,
    msisdn: PHONE,
    tin: TIN,
    ghanaCard: CARD,
    directors: [{ name: "Ama Mensah", ghanaCard: CARD, phone: PHONE }],
    contact: { whatsapp: PHONE },
    alertPhones: [PHONE, "0201234567"],
    note: "kept as typed",
  });
  const row = (await entries()).find((entry) => entry.command === "pii.probe")!;
  const logged = JSON.stringify(row);
  for (const canary of [PHONE, TIN, CARD]) expect(logged).not.toContain(canary);
  expect(row.payload).toMatchObject({
    phone: "••••••7654",
    msisdn: "••••••7654",
    tin: "•••••••5678",
    ghanaCard: "•••••••••••89-0",
    directors: [{ name: "Ama Mensah", ghanaCard: "•••••••••••89-0", phone: "••••••7654" }],
    contact: { whatsapp: "••••••7654" },
    alertPhones: ["••••••7654", "••••••4567"],
    note: "kept as typed",
  });
  expect(row.after).toMatchObject({ tin: "•••••••5678" });
  expect(await verifyChain(await entries())).toMatchObject({ valid: true });
});
