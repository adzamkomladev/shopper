// The owner's own spreadsheets: each entity as CSV and Excel, its rows the database's rows to the last digit.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { verifyChain } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import { exportEntity, entityNames } from "@shopper/export";
import { addSale, exportFixture } from "../../support/export/org";

type Fixture = Awaited<ReturnType<typeof exportFixture>>;
let f: Fixture;
const owner = () => ({ ...f.ctx, actorId: f.userId });
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

beforeAll(async () => {
  f = await exportFixture();
  const orgId = f.ctx.orgId;
  await addSale(f.db, orgId, {
    on: "2026-10-05",
    receipt: "R-0001",
    total: 123456789,
    tenders: [
      { kind: "cash", amount: 100000000 },
      { kind: "card", amount: 23456789 },
    ],
  });
  await addSale(f.db, orgId, {
    on: "2026-10-20",
    receipt: "R-0002",
    total: 50000,
    tenders: [{ kind: "card", amount: 50000 }],
  });
  await addSale(f.db, orgId, {
    on: "2026-11-02",
    receipt: "R-0003",
    total: 10000,
    tenders: [{ kind: "cash", amount: 10000 }],
  });
  const [tax] = await f.db
    .select()
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, orgId))
    .limit(1);
  await f.db.insert(schema.product).values([
    { orgId, sku: "TRICKY", name: 'Maize, "white"\nbag', taxClassId: tax!.id, baseUnit: "each" },
    { orgId, sku: "FORMULA", name: "=1+1", taxClassId: tax!.id, baseUnit: "each" },
    // Another org's product must never reach this org's sheet.
    {
      orgId: f.other.orgId,
      sku: "THEIRS",
      name: "Their secret product",
      taxClassId: (
        await f.db
          .select()
          .from(schema.taxClass)
          .where(eq(schema.taxClass.orgId, f.other.orgId))
          .limit(1)
      )[0]!.id,
      baseUnit: "each",
    },
  ]);
  await f.db.insert(schema.customer).values({
    orgId,
    name: "Kojo",
    phone: "0244000000",
    creditLimit: 5_000_000 as never,
    kycVerifiedAt: new Date("2026-10-01T00:00:00Z"),
  });
});
afterAll(async () => f?.close());

const read = async (entity: (typeof entityNames)[number], format: "csv" | "xlsx", extra = {}) => {
  const out = await exportEntity(f.db, owner(), { entity, format, ...RANGE, ...extra });
  const sheet = XLSX.read(new Uint8Array(await new Response(out.body as BodyInit).arrayBuffer()), {
    type: "array",
  });
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
    Object.values(sheet.Sheets)[0]!,
    { raw: false },
  );
  return { count: out.rows, filename: out.filename, contentType: out.contentType, rows };
};
const scalar = async (query: ReturnType<typeof sql>) =>
  Number((await f.db.execute(query)).rows[0]!.n);
const org = () => f.ctx.orgId;
const counts: Record<(typeof entityNames)[number], () => Promise<number>> = {
  products: () => scalar(sql`select count(*) n from product where org_id = ${org()}`),
  prices: () => scalar(sql`select count(*) n from price where org_id = ${org()}`),
  customers: () => scalar(sql`select count(*) n from customer where org_id = ${org()}`),
  sales: () =>
    scalar(
      sql`select count(*) n from sale where org_id = ${org()} and occurred_at::date between ${RANGE.from}::date and ${RANGE.to}::date`,
    ),
  lines: () =>
    scalar(
      sql`select count(*) n from sale_line l join sale s on s.org_id = l.org_id and s.id = l.sale_id where l.org_id = ${org()} and s.occurred_at::date between ${RANGE.from}::date and ${RANGE.to}::date`,
    ),
  tenders: () =>
    scalar(
      sql`select count(*) n from sale_tender t join sale s on s.org_id = t.org_id and s.id = t.sale_id where t.org_id = ${org()} and s.occurred_at::date between ${RANGE.from}::date and ${RANGE.to}::date`,
    ),
  stock: () =>
    scalar(
      sql`select count(*) n from (select 1 from stock_movement where org_id = ${org()} group by branch_id, product_id) x`,
    ),
  tax: () => scalar(sql`select count(*) n from tax_rule where org_id = ${org()}`),
  audit: () =>
    scalar(
      sql`select count(*) n from audit_log where org_id = ${org()} and created_at::date between ${RANGE.from}::date and ${RANGE.to}::date`,
    ),
};

test("every entity's CSV and Excel hold exactly the database's rows", async () => {
  for (const entity of entityNames) {
    const expected = await counts[entity]();
    const csv = await read(entity, "csv");
    const xlsx = await read(entity, "xlsx");
    expect(csv.rows.length, `${entity} csv`).toBe(expected);
    expect(xlsx.rows.length, `${entity} xlsx`).toBe(expected);
    // A spreadsheet cell is text or a number; the first column (the sheet's identity) reads the same in both.
    expect(
      csv.rows.map((row) => String(Object.values(row)[0])),
      entity,
    ).toEqual(xlsx.rows.map((row) => String(Object.values(row)[0])));
    expect(csv.count, `${entity} audited count`).toBe(expected);
  }
  expect(await counts.sales()).toBe(2);
});

test("paging crosses page boundaries without losing or repeating a row", async () => {
  for (const entity of ["products", "sales", "lines", "audit"] as const) {
    const whole = await read(entity, "csv");
    const paged = await read(entity, "csv", { pageRows: 2 });
    expect(paged.rows.length, entity).toBe(whole.rows.length);
    expect(paged.rows, entity).toEqual(whole.rows);
  }
});

test("amounts are exact decimals from the integers, quantities to three places", async () => {
  const sales = await read("sales", "csv");
  const first = sales.rows.find((row) => row.Receipt === "R-0001")!;
  expect(first.Total).toBe("12345.6789");
  const tenders = (await read("tenders", "csv")).rows.filter((row) => row.Receipt === "R-0001");
  expect(tenders.map((t) => [t.Kind, t.Amount])).toEqual([
    ["cash", "10000.0000"],
    ["card", "2345.6789"],
  ]);
  expect((await read("customers", "csv")).rows[0]!["Credit limit"]).toBe("500.0000");
});

test("a date range holds only its days, and a range over a year is refused", async () => {
  expect(
    (await read("sales", "csv", { from: "2026-11-01", to: "2026-11-05" })).rows.map(
      (r) => r.Receipt,
    ),
  ).toEqual(["R-0003"]);
  await expect(
    exportEntity(f.db, owner(), {
      entity: "sales",
      format: "csv",
      from: "2025-01-01",
      to: "2026-11-30",
    }),
  ).rejects.toThrow("at most 366 days");
  await expect(
    exportEntity(f.db, owner(), {
      entity: "sales",
      format: "csv",
      from: "2026-10-31",
      to: "2026-10-01",
    }),
  ).rejects.toThrow("end on or after");
});

test("text with commas, quotes and newlines survives, a formula is defused, another org's rows never appear", async () => {
  const products = (await read("products", "csv")).rows;
  expect(products.find((row) => row.SKU === "TRICKY")!.Name).toBe('Maize, "white"\nbag');
  expect(products.find((row) => row.SKU === "FORMULA")!.Name).toBe("'=1+1");
  expect(JSON.stringify(products)).not.toContain("Their secret product");
});

test("Excel refuses more rows than its cap and says to use CSV, which has no cap", async () => {
  await expect(
    exportEntity(f.db, owner(), { entity: "products", format: "xlsx", maxWorkbookRows: 1 }),
  ).rejects.toThrow("Too many rows for Excel");
  expect((await read("products", "csv")).rows.length).toBeGreaterThan(1);
});

test("every export is an audited command with its entity, format and row count", async () => {
  const rows = await f.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, org()))
    .orderBy(schema.auditLog.chainSeq);
  const exports = rows.filter((row) => row.command === "export.entity");
  expect(exports.length).toBeGreaterThan(10);
  expect(
    exports.find((row) => (row.payload as { entity: string }).entity === "sales")!.payload,
  ).toMatchObject({ format: "csv", from: "2026-10-01", to: "2026-10-31", rows: 2 });
  expect(exports[0]).toMatchObject({ actorId: f.userId });
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});
