import { expect, test } from "vite-plus/test";
import * as XLSX from "xlsx";
import { call, createProduct, unique } from "./support";
import { csv, detail, ean13, footprint, importOk, upload } from "./import-support";

const xlsx = (rows: (string | number)[][]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Catalogue");
  return XLSX.write(book, { type: "array", bookType: "xlsx" });
};
const basic = (
  sku: string,
  name = sku,
  price: string | number = "1.00",
  barcode: string | number = "",
) => [sku, name, price, barcode, "Standard"];
const headers = ["SKU", "Name", "Selling Price", "Barcodes", "Tax Class"];

test("an XLSX numeric EAN-13 cell keeps all 13 digits", async () => {
  const sku = unique("NUMERIC-EAN");
  const code = 6001234567899; // valid EAN-13 check digit
  await importOk(xlsx([headers, basic(sku, sku, 1, code)]), "numeric.xlsx");
  expect((await detail(sku))!.barcodes.map((item) => item.code)).toContain(String(code));
});

test("a CSV EAN-13 beginning with zero keeps its leading zeros", async () => {
  const sku = unique("ZERO-EAN");
  const code = "0012345678905";
  await importOk(csv(headers, [basic(sku, sku, "1.00", code)]));
  expect((await detail(sku))!.barcodes.map((item) => item.code)).toContain(code);
});

test("numeric prices preserve four decimals and reject precision beyond four", async () => {
  const good = unique("PRICE-4DP");
  const bad = unique("PRICE-5DP");
  const result = await importOk(
    xlsx([headers, basic(good, good, 12.3456), basic(bad, bad, 12.34567)]),
    "prices.xlsx",
  );
  expect(result).toMatchObject({ rowsOk: 1, rowsFailed: 1, created: 1 });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ row: 3, column: "Selling Price" }),
  );
  expect((await detail(good))!.prices.map((price) => price.amount)).toContain(123456);
  expect(await detail(bad)).toBeUndefined();
});

test("text cedi prices parse, while decimal commas are rejected", async () => {
  const good = unique("PRICE-TEXT");
  const bad = unique("PRICE-COMMA");
  const result = await importOk(
    csv(headers, [basic(good, good, " GH₵ 1,250.50 "), basic(bad, bad, "1,50")]),
  );
  expect(result).toMatchObject({ rowsOk: 1, rowsFailed: 1, created: 1 });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ row: 3, column: "Selling Price" }),
  );
  expect((await detail(good))!.prices.map((price) => price.amount)).toContain(12505000);
  expect(await detail(bad)).toBeUndefined();
});

test("headers are matched after trimming and without case", async () => {
  const sku = unique("ODD-HEADER");
  await importOk(
    csv(
      ["  sku ", "DESCRIPTION", "selling price", " VAT "],
      [[sku, "Odd header product", "2.00", "Standard"]],
    ),
  );
  expect(await detail(sku)).toMatchObject({
    name: "Odd header product",
    prices: [expect.objectContaining({ amount: 20000 })],
  });
});

test("UTF-8 BOM CSV with CRLF preserves Ghanaian names", async () => {
  const one = unique("UTF8-A");
  const two = unique("UTF8-B");
  const text = `SKU,Name,Selling Price,Tax Class\r\n${one},Nkatie Burger Café,1.00,Standard\r\n${two},Ɛkuo honey,2.00,Exempt\r\n`;
  await importOk(new TextEncoder().encode(`\uFEFF${text}`));
  expect(await detail(one)).toMatchObject({ name: "Nkatie Burger Café" });
  expect(await detail(two)).toMatchObject({ name: "Ɛkuo honey" });
});

test("blank sheet rows are ignored and errors retain their actual sheet row", async () => {
  const good = unique("GAP-GOOD");
  const bad = unique("GAP-BAD");
  const result = await importOk(
    xlsx([headers, basic(good), ["", "", "", ""], basic(bad, bad, "bad")]),
  );
  expect(result).toMatchObject({ rowsTotal: 2, rowsOk: 1, rowsFailed: 1, created: 1 });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ row: 4, column: "Selling Price" }),
  );
  expect(await detail(good)).toBeDefined();
});

test("a barcode owned by another product errors only its row", async () => {
  const owned = ean13();
  const owner = await createProduct({ barcodes: [{ code: owned }] });
  const stolen = unique("STOLEN");
  const good = unique("BARCODE-GOOD");
  const result = await importOk(csv(headers, [basic(stolen, stolen, "1.00", owned), basic(good)]));
  expect(result).toMatchObject({ rowsOk: 1, rowsFailed: 1, created: 1 });
  expect(result.errors).toContainEqual(expect.objectContaining({ row: 2, column: "Barcodes" }));
  expect(await detail(stolen)).toBeUndefined();
  expect(await detail(good)).toBeDefined();
  expect(await (await call(`/barcodes/${owned}`)).json()).toMatchObject({
    product: { id: owner.id },
  });
});

test("repeated copies of one barcode in a cell are deduplicated", async () => {
  const sku = unique("DUP-CELL");
  const code = ean13();
  await importOk(csv(headers, [basic(sku, sku, "1.00", `${code}; ${code}`)]));
  expect((await detail(sku))!.barcodes.filter((item) => item.code === code)).toHaveLength(1);
});

test("random bytes and a PNG uploaded as XLSX are rejected without writes", async () => {
  const before = await footprint();
  expect((await upload(new Uint8Array([1, 2, 3, 4, 5]), "random.xlsx")).status).toBe(400);
  expect(
    (await upload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image.xlsx"))
      .status,
  ).toBe(400);
  expect(await footprint()).toEqual(before);
});

test("category names differing only by case resolve to one category", async () => {
  const first = unique("CAT-A");
  const second = unique("CAT-B");
  await importOk(
    csv(
      ["SKU", "Name", "Selling Price", "Category", "Tax Class"],
      [
        [first, first, "1.00", "Snacks", "Standard"],
        [second, second, "1.00", "snacks", "Standard"],
      ],
    ),
  );
  const [a, b] = await Promise.all([detail(first), detail(second)]);
  expect(a!.categoryId).toBe(b!.categoryId);
  const categories = (await (await call("/categories")).json()) as { id: string; name: string }[];
  expect(categories.filter((category) => category.name.toLowerCase() === "snacks")).toHaveLength(1);
});

test("Code and SKU together are rejected as ambiguous", async () => {
  const before = await footprint();
  expect(
    (
      await upload(
        csv(
          ["Code", "SKU", "Name", "Selling Price"],
          [[unique("AMBIG"), unique("AMBIG"), "Ambiguous", "1.00"]],
        ),
      )
    ).status,
  ).toBe(400);
  expect(await footprint()).toEqual(before);
});

test("Windows-1252 CSV bytes are rejected with a UTF-8 error", async () => {
  const bytes = new Uint8Array([
    ...new TextEncoder().encode("SKU,Name,Selling Price\r\nLEGACY,Caf"),
    0xe9,
    ...new TextEncoder().encode(",1.00\r\n"),
  ]);
  const response = await upload(bytes);
  expect(response.status).toBe(400);
  expect(JSON.stringify(await response.json()).toLowerCase()).toContain("utf-8");
});
