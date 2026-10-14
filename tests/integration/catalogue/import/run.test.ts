import { inArray, like } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import * as schema from "@shopper/db-pg";
import {
  generateCatalogue,
  messUp,
  toSpreadsheet,
} from "../../../../tooling/lib/catalogue/fixture";
import { allAuditRows, call, db, expectChainValid } from "../support";
import {
  detail,
  footprint,
  importOk,
  productRow,
  sha256,
  sheetRows,
  upload,
  type ImportResult,
} from "./support";

test("bad rows are reported by row and column while good rows land", async () => {
  const { rows, bad } = messUp(generateCatalogue(300, 7), 7);
  const file = toSpreadsheet(rows, "xlsx");
  const result = await importOk(file, "catalogue.xlsx");

  expect(result).toMatchObject({
    dryRun: false,
    rowsTotal: 300,
    rowsOk: 300 - bad.length,
    rowsFailed: bad.length,
    created: 300 - bad.length,
    updated: 0,
    unchanged: 0,
  });
  for (const { row, column } of bad)
    expect(result.errors, `row ${row} column ${column}`).toContainEqual(
      expect.objectContaining({ row, column, message: expect.any(String) }),
    );

  const landed = await db.select().from(schema.product).where(like(schema.product.sku, "SKU-%"));
  expect(landed).toHaveLength(300 - bad.length);
  const skipped = bad.filter((b) => b.column !== "SKU").map((b) => String(rows[b.row - 2]!.SKU));
  expect(
    await db.select().from(schema.product).where(inArray(schema.product.sku, skipped)),
  ).toEqual([]);

  const report = await call(`/catalogue/imports/${result.id}`);
  expect(report.status).toBe(200);
  expect(await report.json()).toMatchObject({
    id: result.id,
    fileName: "catalogue.xlsx",
    sha256: sha256(file),
    rowsTotal: 300,
    rowsFailed: bad.length,
    report: { errors: result.errors },
  });
});

test("CSV and XLSX give the same catalogue", async () => {
  const rows = sheetRows(40);
  const first = await importOk(toSpreadsheet(rows, "csv"), "catalogue.csv");
  expect(first).toMatchObject({ rowsOk: 40, rowsFailed: 0, created: 40, errors: [] });

  const before = await Promise.all(rows.map((row) => productRow(String(row.SKU))));
  const second = await importOk(toSpreadsheet(rows, "xlsx"), "catalogue.xlsx");
  expect(second).toMatchObject({
    rowsOk: 40,
    created: 0,
    updated: 0,
    unchanged: 40,
    pricesAdded: 0,
  });
  const after = await Promise.all(rows.map((row) => productRow(String(row.SKU))));
  expect(after.map((p) => p?.updatedAt)).toEqual(before.map((p) => p?.updatedAt));

  const packed = await detail(String(rows[0]!.SKU));
  expect(packed).toMatchObject({ name: rows[0]!.Name, baseUnit: "kg", taxClass: "standard" });
  expect(packed!.barcodes).toContainEqual({
    code: rows[0]!["Pack Barcode"],
    quantityThousandths: 12000,
  });
  expect(packed!.prices.map((p) => p.amount)).toEqual([55000]);
  expect(await detail(String(rows[1]!.SKU))).toMatchObject({
    baseUnit: "each",
    taxClass: "zero-rated",
  });
  expect(await detail(String(rows[2]!.SKU))).toMatchObject({
    taxClass: "exempt",
    onlineVisible: false,
  });
});

test("re-importing the same file changes nothing and adds no price versions", async () => {
  const file = toSpreadsheet(sheetRows(25), "csv");
  const first = await importOk(file);
  const rowsBefore = await db.select().from(schema.product);
  const pricesBefore = await db.select().from(schema.price);
  const auditBefore = (await allAuditRows()).length;
  const imports = await db.select().from(schema.productImport);

  const second = await importOk(file);
  expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 25, pricesAdded: 0 });
  expect(second.id).not.toBe(first.id);
  expect(await db.select().from(schema.product)).toEqual(rowsBefore);
  expect(await db.select().from(schema.price)).toEqual(pricesBefore);
  expect(await db.select().from(schema.productImport)).toHaveLength(imports.length + 1);
  expect((await allAuditRows()).length).toBe(auditBefore + 2);
});

test("a dry run only records its uploaded asset", async () => {
  const rows = sheetRows(15);
  rows[4]!["Selling Price"] = "abc";
  const before = await footprint();

  const response = await upload(toSpreadsheet(rows, "csv"), "dry.csv", { dryRun: true });
  expect(response.status).toBe(200);
  const dry = (await response.json()) as ImportResult;
  expect(dry).toMatchObject({
    dryRun: true,
    rowsTotal: 15,
    rowsOk: 14,
    rowsFailed: 1,
    created: 14,
  });
  expect(dry.errors).toEqual([
    expect.objectContaining({ row: 6, column: "Selling Price", value: "abc" }),
  ]);
  expect(dry.id).toBeUndefined();
  expect(await footprint()).toEqual(before);

  const real = await importOk(toSpreadsheet(rows, "csv"), "real.csv");
  expect(real).toMatchObject({
    created: dry.created,
    updated: dry.updated,
    rowsFailed: dry.rowsFailed,
  });
});

test("one import audits its grant and catalogue counts without recording the grant URL", async () => {
  const file = toSpreadsheet(sheetRows(30), "xlsx");
  const before = (await allAuditRows()).length;
  const result = await importOk(file, "audit.xlsx");

  const written = (await allAuditRows()).slice(before);
  expect(written).toHaveLength(2);
  expect(written[0]!.command).toBe("asset.upload.issue");
  expect(JSON.stringify(written)).not.toContain("X-Amz-Signature");
  expect(written[1]).toMatchObject({
    command: "catalogue.import",
    entity: "product_import",
    entityId: result.id,
  });
  expect(written[1]!.payload).toMatchObject({ sha256: sha256(file), rowsTotal: 30, rowsOk: 30 });
  await expectChainValid();
  expect(await (await call(`/catalogue/imports/${result.id}`)).json()).toMatchObject({
    fileName: "audit.xlsx",
    sha256: sha256(file),
    rowsOk: 30,
    priceValidFrom: expect.any(String),
    createdAt: expect.any(String),
  });
});

test("CSV import retains its fixed byte digest", async () => {
  const result = await importOk(
    "SKU,Name,Selling Price\ndigest-fixture,Digest Fixture,1.00\n",
    "digest.csv",
  );
  expect(await (await call(`/catalogue/imports/${result.id}`)).json()).toMatchObject({
    sha256: "db7fc891e233eddde58998e2181f77be86d4b713a8d6c0291064dd004b6ad883",
  });
});
