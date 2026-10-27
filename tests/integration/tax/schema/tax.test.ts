import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/core";
import { createApi } from "@shopper/api";
import {
  add,
  sub,
  fromDecimal,
  money,
  mulQty,
  mulRate,
  toDecimal,
  toPesewas,
  formatGHS,
} from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import {
  provisionOrg,
  provisioningContext,
  seedDevelopment,
} from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: import("@shopper/db-pg").ShopperDatabase;
const context = provisioningContext();
beforeAll(async () => {
  fixture = await postgresFixture();
  db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Test tenant" });
});
afterAll(async () => {
  await fixture?.close();
});

const createStore = defineCommand({
  name: "store.create",
  run: async (tx, ctx, input: { cashRoundingStep: ReturnType<typeof money> }) => {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Test store", ...input })
      .returning();
    return row!;
  },
  audit: (_input, row) => ({ storeId: row.id, cashRoundingStep: row.cashRoundingStep }),
});

test("current schema migrates twice, uses tenant UUIDv7 keys, and preserves bigint money through Drizzle", async () => {
  const tables = await fixture.client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  expect(tables.rows.map((row) => row.table_name).join(" ")).toBe(
    "account account_hold asset audit_anchor audit_log barcode_mapping branch cashier_pin cashier_session category credit_entry customer device device_audit device_credential device_enrollment enrollment_attempt fiscal_archive fiscal_doc invitation kyc_case loyalty_entry loyalty_tier member member_branch org payment permission price product product_barcode product_import receipt_block refund refund_line registration_audit_log registration_request registration_workflow_run registration_workflow_step reorder_point report_product report_sales report_tender role role_permission sale sale_line sale_tender session shift shift_movement shift_tender shopper_meta statement_delivery statement_link stock_alert stock_document stock_movement stock_take stock_take_line store store_change store_day supplier tax_class tax_rule tier_notice user vat_return verification workflow_run workflow_step",
  );
  const columns = await fixture.client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'org_id'",
  );
  expect(columns.rowCount).toBe(72);
  // Pre-shop registration rows reference their request; every customer table keeps an org FK.
  const orgForeignKeys = await fixture.client.query<{ table_name: string; target: string }>(
    `SELECT c.conrelid::regclass::text AS table_name, c.confrelid::regclass::text AS target
     FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND a.attname = 'org_id' AND array_length(c.conkey, 1) = 1
       AND c.connamespace = 'public'::regnamespace`,
  );
  const targets = new Map(orgForeignKeys.rows.map((row) => [row.table_name, row.target]));
  for (const table of ["asset", "audit_log", "workflow_run", "workflow_step", "store", "branch"])
    expect(targets.get(table)).toBe("org");
  expect(targets.get("receipt_block")).toBe("org");
  for (const table of ["audit_log", "workflow_run", "workflow_step"])
    expect(targets.get(`registration_${table}`)).toBe("registration_request");
  expect(targets.has("registration_request")).toBe(false);
  const serials = await fixture.client.query(
    "SELECT * FROM information_schema.columns WHERE table_schema IN ('public', 'drizzle') AND (column_default LIKE '%nextval%' OR is_identity = 'YES')",
  );
  expect(serials.rowCount).toBe(0);
  const huge = fromDecimal("900719925474.0991");
  const row = await createStore(db, context, { cashRoundingStep: huge });
  expect(row.id[14]).toBe("7");
  const [loaded] = await db.select().from(schema.store).where(eq(schema.store.id, row.id));
  expect(toDecimal(loaded!.cashRoundingStep, 4)).toBe("900719925474.0991");
  expect(() => add(huge, money(1))).toThrow(RangeError);
  expect(() => fromDecimal("900719925474.0992")).toThrow(RangeError);
  expect(() => money(1.5)).toThrow();
  const cases = [
    { amount: mulQty(fromDecimal("2.0001"), 1_500), decimal: "3.0002", pesewas: 300 },
    { amount: mulRate(fromDecimal("1.0002"), 2_500), decimal: "0.2501", pesewas: 25 },
    { amount: fromDecimal("12.3450"), decimal: "12.3450", pesewas: 1_235 },
  ];
  for (const value of cases) {
    const stored = await createStore(db, context, { cashRoundingStep: value.amount });
    expect(toDecimal(stored.cashRoundingStep, 4)).toBe(value.decimal);
    expect(toPesewas(stored.cashRoundingStep)).toBe(value.pesewas);
  }
  expect(toDecimal(sub(money(0), fromDecimal("12.3450")))).toBe("-12.35");
  expect(toPesewas(fromDecimal("-0.0050"))).toBe(-1);
  expect(formatGHS(fromDecimal("1234.5678"))).toBe("GH₵ 1,234.57");
});

test("commands roll back on audit failure, reject cross-tenant references, and keep history immutable", async () => {
  const before = await db.select().from(schema.store);
  await expect(
    createStore(db, { ...context, actorId: v7() }, { cashRoundingStep: money(100) }),
  ).rejects.toThrow();
  expect(await db.select().from(schema.store)).toEqual(before);
  const other = provisioningContext();
  await provisionOrg(db, other, { name: "Other tenant" });
  const row = await createStore(db, context, { cashRoundingStep: money(100) });
  const createBranch = defineCommand({
    name: "branch.create",
    run: (tx, ctx, storeId: string) =>
      tx.insert(schema.branch).values({ orgId: ctx.orgId, storeId, name: "Branch" }).returning(),
    audit: () => ({ fixture: true }),
  });
  await expect(createBranch(db, other, row.id)).rejects.toThrow();
  const [audit] = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  expect(audit!.appVersion).toBe(context.appVersion);
  await expect(
    db.delete(schema.auditLog).where(eq(schema.auditLog.id, audit!.id)),
  ).rejects.toThrow();
  const [meta] = await db
    .select()
    .from(schema.shopperMeta)
    .where(eq(schema.shopperMeta.orgId, context.orgId));
  expect(meta!.event).toBe("install");
  await expect(db.update(schema.shopperMeta).set({ event: "upgrade" })).rejects.toThrow();
  const updateStore = defineCommand({
    name: "store.rename",
    run: async (tx, _ctx, storeId: string) => {
      await tx.execute(sql`SELECT pg_sleep(0.002)`);
      return tx
        .update(schema.store)
        .set({ name: "Renamed" })
        .where(eq(schema.store.id, storeId))
        .returning();
    },
    audit: () => ({ fixture: true }),
  });
  const [updated] = await updateStore(db, context, row.id);
  expect(updated!.updatedAt.valueOf()).toBeGreaterThan(row.updatedAt.valueOf());
});

test("seeded dated rules are selected through the tenant API and drive exact tax snapshots", async () => {
  const firstSeed = await seedDevelopment(db);
  const secondSeed = await seedDevelopment(db);
  expect(firstSeed.created).toBe(true);
  expect(secondSeed).toEqual({ id: firstSeed.id, created: false });
  // A dev org seeded before shop codes existed has the default uuid slug; seeding again gives it "dev".
  await db
    .update(schema.org)
    .set({ slug: "0198-default-slug" })
    .where(eq(schema.org.id, firstSeed.id));
  await seedDevelopment(db);
  const [seeded] = await db.select().from(schema.org).where(eq(schema.org.id, firstSeed.id));
  expect(seeded!.slug).toBe("dev");
  const api = createApi({ database: db, resolveOrgId: async () => context.orgId });
  const get = (date: string) => api.request(`/tax-rules?on=${date}`);
  expect((await get("2025-12-31")).status).toBe(404);
  for (const bad of ["2026-02-30", "invalid", "0000-01-01"])
    expect((await get(bad)).status).toBe(400);
  const lookup = (options: Parameters<typeof createApi>[0]) =>
    createApi(options).request("/tax-rules?on=2026-01-01");
  expect((await lookup({ database: db })).status).toBe(401);
  expect((await lookup({ resolveOrgId: async () => context.orgId })).status).toBe(503);
  const response = await get("2026-01-01");
  expect(response.status).toBe(200);
  const rule = await response.json();
  expect(rule).toMatchObject({
    orgId: context.orgId,
    effectiveFrom: "2026-01-01",
    vatBps: 1500,
    nhilBps: 250,
    getfundBps: 250,
    covidBps: 0,
  });
  const inclusive = snapshotLine({
    rule,
    on: "2026-01-01",
    taxClass: "standard",
    priceMode: "inclusive",
    registered: true,
    unitPrice: fromDecimal("120"),
    quantityThousandths: 1000,
  });
  expect(inclusive).toMatchObject({
    base: fromDecimal("100"),
    vat: fromDecimal("15"),
    nhil: fromDecimal("2.5"),
    getfund: fromDecimal("2.5"),
    covid: money(0),
    gross: fromDecimal("120"),
  });
  for (const taxClass of ["standard", "zero-rated", "exempt"] as const) {
    for (const priceMode of ["inclusive", "exclusive"] as const) {
      const snapshot = snapshotLine({
        rule,
        on: "2026-10-05",
        taxClass,
        priceMode,
        registered: true,
        unitPrice: fromDecimal("0.0003"),
        quantityThousandths: 1500,
        discount: money(1),
      });
      expect(
        [
          snapshot.vat,
          snapshot.nhil,
          snapshot.getfund,
          snapshot.covid,
          snapshot.roundingAdjustment,
        ].reduce(add, snapshot.base),
      ).toBe(snapshot.gross);
      if (taxClass !== "standard") expect(snapshot.vat).toBe(0);
      expect(Object.isFrozen(snapshot.rule)).toBe(true);
    }
  }
  const insertFuture = defineCommand({
    name: "tax.rule.fixture",
    run: (tx, ctx) =>
      tx.insert(schema.taxRule).values({
        orgId: ctx.orgId,
        effectiveFrom: "2027-01-01",
        vatBps: 1000,
        nhilBps: 0,
        getfundBps: 0,
        covidBps: 0,
        source: "integration fixture; not a statutory rule",
      }),
    audit: () => ({ fixture: true }),
  });
  await insertFuture(db, context, undefined);
  expect(await (await get("2026-12-31")).json()).toMatchObject({ id: rule.id });
  expect(await (await get("2027-01-01")).json()).toMatchObject({ vatBps: 1000 });
  expect(
    await (await api.request(`/tax-rules?on=2026-01-01&orgId=${firstSeed.id}`)).json(),
  ).toMatchObject({ orgId: context.orgId });
});
