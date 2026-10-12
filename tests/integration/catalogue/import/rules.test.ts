import { expect, test } from "vite-plus/test";
import { toSpreadsheet } from "../../../../tooling/lib/catalogue-fixture";
import { barcode, call, createProduct, unique } from "../support";
import { csv, detail, ean13, footprint, importOk, productRow, sheetRows, upload } from "./support";

type Named = { id: string; name: string; parentId?: string | null };
const list = async (path: string) => (await (await call(path)).json()) as Named[];

test("messy cells (spaces, GH₵ prefixes, mixed-case units, VAT aliases) are cleaned", async () => {
  const tag = unique("MESSY");
  const [a, b, c, d, e, f, g] = Array.from({ length: 7 }, ean13);
  const file = csv(
    [
      " Code",
      "DESCRIPTION",
      "barcode",
      "Pack Barcode",
      "pack  qty",
      "unit",
      "Department",
      "Category",
      "supplier",
      "VAT",
      "Price",
      "Online",
    ],
    [
      [
        `${tag}-1`,
        "  Milo  Tin ",
        `${a}; ${b}`,
        c,
        24,
        "KG",
        "Beverages",
        "Malt",
        "Nestlé Ghana",
        "VAT",
        "GH₵ 1,250.50",
        "TRUE",
      ],
      [
        `${tag}-2`,
        "Water",
        `${d},${e}`,
        "",
        "",
        "mL",
        "BEVERAGES",
        "malt",
        "NESTLÉ GHANA",
        "0%",
        " GHS 12 ",
        "0",
      ],
      [`${tag}-3`, "Sugar", `${f}|${g}`, "", "", "", "", "Staples", "", "none", "2 500", ""],
    ],
  );
  const result = await importOk(file);
  expect(result).toMatchObject({ rowsOk: 3, rowsFailed: 0, created: 3, errors: [] });

  const [milo, water, sugar] = await Promise.all([1, 2, 3].map((n) => detail(`${tag}-${n}`)));
  expect(milo).toMatchObject({
    name: "Milo Tin",
    baseUnit: "kg",
    taxClass: "standard",
    onlineVisible: true,
  });
  expect(milo!.barcodes).toEqual(
    [
      { code: a, quantityThousandths: 1000 },
      { code: b, quantityThousandths: 1000 },
      { code: c, quantityThousandths: 24000 },
    ].sort((x, y) => x.code.localeCompare(y.code)),
  );
  expect(milo!.prices.map((p) => p.amount)).toEqual([12505000]);
  expect(water).toMatchObject({ baseUnit: "ml", taxClass: "zero-rated", onlineVisible: false });
  expect(water!.barcodes.map((x) => x.code).sort()).toEqual([d, e].sort());
  expect(water!.prices.map((p) => p.amount)).toEqual([120000]);
  expect(sugar).toMatchObject({
    baseUnit: "each",
    taxClass: "exempt",
    onlineVisible: false,
    supplierId: null,
  });
  expect(sugar!.barcodes).toHaveLength(2);
  expect(sugar!.prices.map((p) => p.amount)).toEqual([25000000]);

  const categories = await list("/categories");
  const beverages = categories.filter((x) => x.name.toLowerCase() === "beverages");
  expect(beverages).toHaveLength(1);
  const malt = categories.filter((x) => x.name.toLowerCase() === "malt");
  expect(malt).toHaveLength(1);
  expect(malt[0]!.parentId).toBe(beverages[0]!.id);
  expect(milo!.categoryId).toBe(malt[0]!.id);
  expect(water!.categoryId).toBe(malt[0]!.id);
  expect(categories.find((x) => x.name === "Staples")!.parentId ?? null).toBeNull();
  expect(milo!.supplierId).toBe(water!.supplierId);
  expect(
    (await list("/suppliers")).filter((x) => x.name.toLowerCase() === "nestlé ghana"),
  ).toHaveLength(1);
});

test("an existing SKU is updated in place and only changed rows are touched", async () => {
  const rows = sheetRows(10);
  await importOk(toSpreadsheet(rows, "csv"));
  const before = await Promise.all(rows.map((r) => productRow(String(r.SKU))));

  rows[3]!.Name = `${rows[3]!.Name} renamed`;
  rows[3]!.Supplier = "A brand new supplier";
  const result = await importOk(toSpreadsheet(rows, "csv"));
  expect(result).toMatchObject({ created: 0, updated: 1, unchanged: 9, pricesAdded: 0 });

  const after = await Promise.all(rows.map((r) => productRow(String(r.SKU))));
  after.forEach((row, i) =>
    i === 3
      ? expect(row!.updatedAt.getTime()).toBeGreaterThan(before[i]!.updatedAt.getTime())
      : expect(row).toEqual(before[i]),
  );
  expect(after[3]).toMatchObject({ id: before[3]!.id, name: rows[3]!.Name });
  expect(await detail(String(rows[3]!.SKU))).toMatchObject({ supplierId: expect.any(String) });
});

test("a price change on re-import adds exactly one new version and the lookup returns it", async () => {
  const rows = sheetRows(6);
  await importOk(toSpreadsheet(rows, "csv"));
  rows[2]!["Selling Price"] = "12.00";
  const result = await importOk(toSpreadsheet(rows, "csv"));
  expect(result).toMatchObject({ created: 0, pricesAdded: 1, rowsFailed: 0 });

  const changed = await detail(String(rows[2]!.SKU));
  expect(changed!.prices.map((p) => p.amount).sort((x, y) => x - y)).toEqual([75000, 120000]);
  expect((await detail(String(rows[1]!.SKU)))!.prices).toHaveLength(1);
  const found = await call(`/barcodes/${rows[2]!.Barcodes}`);
  expect(await found.json()).toMatchObject({ price: { amount: 120000 } });
});

test("a duplicate SKU or barcode in the file, or a barcode on another product, errors the later row", async () => {
  const owned = ean13();
  const existing = await createProduct({ barcodes: [{ code: owned }] });
  const rows = sheetRows(5);
  rows[1]!.SKU = rows[0]!.SKU; // row 3 repeats row 2's SKU
  rows[3]!.Barcodes = String(rows[2]!.Barcodes); // row 5 repeats row 4's barcode
  rows[4]!.Barcodes = owned; // row 6 steals a barcode from a product already in the catalogue

  const result = await importOk(toSpreadsheet(rows, "csv"));
  expect(result).toMatchObject({ rowsTotal: 5, rowsOk: 2, rowsFailed: 3, created: 2 });
  expect(result.errors.map(({ row, column }) => ({ row, column }))).toEqual([
    { row: 3, column: "SKU" },
    { row: 5, column: "Barcodes" },
    { row: 6, column: "Barcodes" },
  ]);
  expect((await detail(String(rows[0]!.SKU)))!.name).toBe(rows[0]!.Name);
  expect(await detail(String(rows[4]!.SKU))).toBeUndefined();
  expect((await (await call(`/barcodes/${owned}`)).json()).product.id).toBe(existing.id);
});

test("only product.write may import, and bad uploads are refused with nothing written", async () => {
  const file = toSpreadsheet(sheetRows(3), "csv");
  const before = await footprint();
  for (const role of ["inventory", "cashier"])
    expect((await upload(file, "catalogue.csv", { role })).status, role).toBe(403);
  expect((await upload(file, "catalogue.csv", { role: "admin", dryRun: true })).status).toBe(200);

  expect((await upload(new Uint8Array(10 * 1024 * 1024 + 1), "big.csv")).status).toBe(413);
  expect((await upload(new Uint8Array(), "empty.csv")).status).toBe(400);
  expect(
    (await upload(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 9, 9]), "broken.xlsx")).status,
  ).toBe(400);
  const none = await call("/catalogue/imports", "POST", {});
  expect(none.status, "no multipart file").toBe(400);

  for (const header of ["SKU", "Name", "Selling Price"]) {
    const headers = ["SKU", "Name", "Selling Price", "Unit"].filter((h) => h !== header);
    const response = await upload(csv(headers, [headers.map(() => "1")]));
    expect(response.status, `missing ${header}`).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(header);
  }
  expect(await footprint()).toEqual(before);
  expect((await call(`/catalogue/imports/${barcode()}`)).status).toBe(404);
});
