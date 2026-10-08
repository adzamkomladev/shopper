import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "../packages/db-pg/src/schema";
import { defineCommand } from "../packages/core/src/index";
import { createApi } from "../packages/api/src/index";
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
} from "../packages/money/src/index";
import { snapshotLine } from "../packages/tax/src/index";
import { migrateDatabase } from "../tooling/migrate";
import { provisionOrg, provisioningContext, seedDevelopment } from "../tooling/seed";
import { postgresFixture } from "./fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: import("../packages/db-pg/src/index").ShopperDatabase;
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
  expect(tables.rows.map((row) => row.table_name)).toEqual([
    "account",
    "audit_log",
    "branch",
    "cashier_pin",
    "cashier_session",
    "device",
    "device_credential",
    "device_enrollment",
    "enrollment_attempt",
    "invitation",
    "member",
    "org",
    "permission",
    "role",
    "role_permission",
    "session",
    "shopper_meta",
    "store",
    "tax_class",
    "tax_rule",
    "user",
    "verification",
    "workflow_run",
    "workflow_step",
  ]);
  const columns = await fixture.client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'org_id'",
  );
  expect(columns.rowCount).toBe(24);
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
  // Converted integration inputs also round-trip through the same bigint column.
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
  const api = createApi({ database: db, resolveOrgId: async () => context.orgId });
  const get = (date: string) => api.request(`/tax-rules?on=${date}`);
  expect((await get("2025-12-31")).status).toBe(404);
  expect((await get("2026-02-30")).status).toBe(400);
  expect((await get("invalid")).status).toBe(400);
  expect((await get("0000-01-01")).status).toBe(400);
  expect((await createApi({ database: db }).request("/tax-rules?on=2026-01-01")).status).toBe(401);
  expect(
    (
      await createApi({ resolveOrgId: async () => context.orgId }).request(
        "/tax-rules?on=2026-01-01",
      )
    ).status,
  ).toBe(503);
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
  // A caller-supplied tenant parameter cannot change the trusted session scope.
  expect(
    await (await api.request(`/tax-rules?on=2026-01-01&orgId=${firstSeed.id}`)).json(),
  ).toMatchObject({ orgId: context.orgId });
});
