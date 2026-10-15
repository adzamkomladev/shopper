// Slice 3: offline catalogue search. Exact barcode, then exact SKU, then FTS5 name matches in a fixed order.
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { lookupCode, projectProducts, searchCatalogue } from "@shopper/core/till";
import { code, ids, product, tempTill, type ProductRow } from "../../../support/till/catalogue";

let till: Awaited<ReturnType<typeof tempTill>>;
beforeEach(async () => {
  till = await tempTill();
});
afterEach(() => till.close());

const index = (rows: ProductRow[], orgId: string = ids.org) =>
  till.database.transaction((tx) => projectProducts(tx, orgId, rows));
const search = (query: string, extra: { limit?: number; orgId?: string } = {}) =>
  searchCatalogue(till.database, { orgId: ids.org, query, ...extra });
const names = async (query: string) => (await search(query)).map((row) => row.name);

test("an exact barcode outranks an exact SKU, which outranks name matches", async () => {
  const byName = product({ sku: "N-1", name: "Milk 0012345 pack" });
  const bySku = product({ sku: "0012345", name: "Zebra sku" });
  const byBarcode = product({ sku: "B-1", name: "Aardvark barcode", barcodes: [code("0012345")] });
  await index([byName, bySku, byBarcode]);
  const rows = await search("0012345");
  expect(rows.map((row) => [row.productId, row.match])).toEqual([
    [byBarcode.id, "barcode"],
    [bySku.id, "sku"],
    [byName.id, "name"],
  ]);
});

test("a product matching on barcode and name appears once, as the barcode match", async () => {
  const both = product({ name: "0012345 special", barcodes: [code("0012345")] });
  await index([both]);
  expect(await search("0012345")).toMatchObject([{ productId: both.id, match: "barcode" }]);
});

test("leading zeros are preserved and a barcode only matches exactly", async () => {
  const packed = product({ barcodes: [code("0012345", 12_000), code("0098765", 1000)] });
  await index([packed]);
  expect(await search("0012345")).toMatchObject([
    { productId: packed.id, match: "barcode", barcode: "0012345", quantityThousandths: 12_000 },
  ]);
  expect(await search("0098765")).toMatchObject([{ quantityThousandths: 1000 }]);
  expect(await search("12345")).toEqual([]);
  expect(await lookupCode(till.database, { orgId: ids.org, code: "12345" })).toBeUndefined();
  expect(await lookupCode(till.database, { orgId: ids.org, code: "0012345" })).toMatchObject({
    productId: packed.id,
    barcode: "0012345",
    quantityThousandths: 12_000,
  });
});

test("lookupCode is an exact barcode lookup only, so a SKU or name is not a hit", async () => {
  await index([product({ sku: "SKU-ONLY", name: "Name only" })]);
  for (const value of ["SKU-ONLY", "Name only", ""])
    expect(await lookupCode(till.database, { orgId: ids.org, code: value })).toBeUndefined();
});

test("name matches are prefix, multi-token and case-insensitive, ordered by name then id", async () => {
  const tin = [product({ name: "Milo tin" }), product({ name: "Milo tin" })];
  const sachet = product({ name: "Milo sachet" });
  await index([tin[0]!, sachet, tin[1]!, product({ name: "Tea bags" })]);
  const rows = await search("MIL");
  const sortedIds = [tin[0]!.id, tin[1]!.id].sort();
  expect(rows.map((row) => row.productId)).toEqual([sachet.id, ...sortedIds]);
  expect(await names("milo ti")).toEqual(["Milo tin", "Milo tin"]);
  expect(await names("tin milo")).toEqual(["Milo tin", "Milo tin"]);
  expect(await names("milo coffee")).toEqual([]);
});

test("a query returns at most 50 rows, honouring a smaller limit", async () => {
  await index(
    Array.from({ length: 120 }, (_, n) => product({ name: `Soap ${String(n).padStart(3, "0")}` })),
  );
  const all = await search("soap");
  expect(all).toHaveLength(50);
  expect(all.map((row) => row.name)).toEqual(
    Array.from({ length: 50 }, (_, n) => `Soap ${String(n).padStart(3, "0")}`),
  );
  expect(await search("soap", { limit: 10 })).toHaveLength(10);
  expect(await search("soap", { limit: 500 })).toHaveLength(50);
});

test("FTS syntax in the query is literal text and never throws", async () => {
  await index([
    product({ name: "Milo" }),
    product({ name: "Tea" }),
    product({ name: "Near East Rice" }),
  ]);
  const hostile = [
    '"',
    '""',
    '"Milo',
    "*",
    "**",
    "NEAR",
    "NEAR(",
    "NEAR(Milo Tea, 2)",
    "-",
    "OR",
    "AND",
    "NOT",
    "(",
    ")",
    "milo:",
    "name:milo",
    "^milo",
    "a OR b",
    "x' --",
    "%",
    "_",
  ];
  for (const query of hostile) await expect(search(query), query).resolves.toBeInstanceOf(Array);
  expect(await names("Milo OR Tea")).toEqual([]);
  expect(await names("Milo -Tea")).toEqual([]);
  expect(await names("-Milo")).toEqual(["Milo"]);
  expect(await names("NEAR")).toEqual(["Near East Rice"]);
  expect(await names('"Near East"')).toEqual(["Near East Rice"]);
  expect(await names("")).toEqual([]);
});

test("another organisation's products are invisible, even for the same barcode", async () => {
  const mine = product({ name: "Shared name", sku: "SHARED", barcodes: [code("0011111")] });
  const theirs = product({
    orgId: ids.otherOrg,
    name: "Shared name",
    sku: "SHARED",
    barcodes: [code("0011111", 6000), code("0022222")],
  });
  await index([mine]);
  await index([theirs], ids.otherOrg);
  expect((await search("shared")).map((row) => row.productId)).toEqual([mine.id]);
  expect((await search("0011111")).map((row) => row.productId)).toEqual([mine.id]);
  expect(await search("0022222")).toEqual([]);
  expect(await lookupCode(till.database, { orgId: ids.org, code: "0022222" })).toBeUndefined();
  expect(await lookupCode(till.database, { orgId: ids.otherOrg, code: "0011111" })).toMatchObject({
    productId: theirs.id,
    quantityThousandths: 6000,
  });
});

test("archived products are not returned and archiving removes an indexed product", async () => {
  const live = product({ name: "Gone soon", barcodes: [code("0033333")] });
  const archived = product({
    name: "Gone already",
    barcodes: [code("0044444")],
    archivedAt: "2026-10-01T00:00:00.000Z",
  });
  await index([live, archived]);
  expect(await names("gone")).toEqual(["Gone soon"]);
  expect(await search("0044444")).toEqual([]);
  expect(await lookupCode(till.database, { orgId: ids.org, code: "0044444" })).toBeUndefined();
  await index([{ ...live, archivedAt: "2026-10-02T00:00:00.000Z" }]);
  expect(await search("gone")).toEqual([]);
  expect(await search("0033333")).toEqual([]);
});

test("re-projecting a product replaces its name, SKU and barcodes", async () => {
  const before = product({ sku: "OLD-SKU", name: "Old name", barcodes: [code("0055555")] });
  await index([before]);
  await index([{ ...before, sku: "NEW-SKU", name: "New name", barcodes: [code("0066666", 3000)] }]);
  expect(await search("old")).toEqual([]);
  expect(await search("OLD-SKU")).toEqual([]);
  expect(await search("0055555")).toEqual([]);
  expect(await search("NEW-SKU")).toMatchObject([{ match: "sku", name: "New name" }]);
  expect(await search("0066666")).toMatchObject([{ quantityThousandths: 3000 }]);
  expect(await names("new")).toEqual(["New name"]);
});

test("search rows carry no price; prices are fetched only for the selected product", async () => {
  await index([product({ name: "Priced", barcodes: [code("0077777")] })]);
  for (const query of ["priced", "0077777"]) {
    const [row] = await search(query);
    expect(row).toBeDefined();
    expect(Object.keys(row!).filter((key) => /price|amount|tax|vat/i.test(key))).toEqual([]);
  }
});
