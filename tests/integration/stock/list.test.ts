import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import * as v from "valibot";
import {
  listDocuments,
  listStock,
  readDocument,
  readStockProduct,
  stockBranches,
  StockError,
} from "@shopper/core/stock";
import { documentDetail, documentList, stockList, stockProductView } from "@shopper/core/schemas";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { addDocument, addMovements, addSupplier, setLevel } from "../../support/stock/seed";

// Rice: +24 at 08:00, -3 at 10:00, -1 at 11:00 -> 20 on hand, reorder level 20 (low).
// Tomatoes: +10.5 -> 10.5 on hand, level 5 (fine). The other six golden products have no movements.
let world: Awaited<ReturnType<typeof goldenWorld>>;
const rice = products.standard.id;
const tomatoes = products.weighed.id;
const branchId = ids.branch;
const db = () => databases().db;

beforeAll(async () => {
  world = await goldenWorld();
  await addMovements([
    { productId: rice, quantity: 24_000, at: "08:00" },
    { productId: rice, quantity: -3_000, at: "10:00" },
    { productId: rice, quantity: -1_000, at: "11:00" },
    { productId: tomatoes, quantity: 10_500, at: "08:00" },
  ]);
  await setLevel(rice, 20_000);
  await setLevel(tomatoes, 5_000);
});
afterAll(async () => {
  await world?.local.close();
});

test("The stock list pages by product, searches and filters to low stock", async () => {
  const pages = [];
  let cursor: string | undefined;
  do {
    const page = v.parse(
      stockList,
      await listStock(db(), ids.org, { branchId, limit: "3", ...(cursor ? { cursor } : {}) }),
    );
    pages.push(page.items.map((item) => item.name));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(pages.map((names) => names.length)).toEqual([3, 3, 2]);
  expect(pages.flat()).toContain("Rice");

  const searched = await listStock(db(), ids.org, { branchId, q: "tomato" });
  expect(searched.items).toEqual([
    expect.objectContaining({
      productId: tomatoes,
      onHandThousandths: 10_500,
      levelThousandths: 5_000,
      low: false,
    }),
  ]);

  const low = await listStock(db(), ids.org, { branchId, low: "1" });
  expect(low.items).toEqual([
    expect.objectContaining({
      productId: rice,
      onHandThousandths: 20_000,
      levelThousandths: 20_000,
      low: true,
    }),
  ]);
  const plain = await listStock(db(), ids.org, { branchId, q: "Exempt" });
  expect(plain.items[0]).toMatchObject({
    onHandThousandths: 0,
    levelThousandths: null,
    low: false,
  });
});

test("Another org's branch is not found", async () => {
  await expect(listStock(db(), ids.otherOrg, { branchId })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(readStockProduct(db(), ids.otherOrg, rice, { branchId })).rejects.toBeInstanceOf(
    StockError,
  );
  expect(await stockBranches(db(), ids.otherOrg)).toEqual({ branches: [] });
  expect((await stockBranches(db(), ids.org)).branches.map((b) => b.id)).toContain(branchId);
});

test("Product stock shows movements newest first with a running balance", async () => {
  const detail = v.parse(
    stockProductView,
    await readStockProduct(db(), ids.org, rice, { branchId }),
  );
  expect(detail).toMatchObject({
    productId: rice,
    name: "Rice",
    onHandThousandths: 20_000,
    levelThousandths: 20_000,
  });
  expect(detail.movements.map((m) => [m.quantityThousandths, m.balanceThousandths])).toEqual([
    [-1_000, 20_000],
    [-3_000, 21_000],
    [24_000, 24_000],
  ]);
  expect(detail.movements.every((m) => m.reason === "adjustment")).toBe(true);
  expect(detail.truncated).toBe(false);
  await expect(
    readStockProduct(db(), ids.org, ids.otherProduct, { branchId }),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("Stock records list newest first, filter by kind and open with their lines", async () => {
  const supplierId = await addSupplier("Accra Grains");
  const receipt = await addDocument({
    kind: "receipt",
    supplierId,
    at: "12:00",
    lines: [
      { productId: rice, quantity: 5_000, unitCost: 95_000 },
      { productId: tomatoes, quantity: 2_000, unitCost: 280_000 },
    ],
  });
  const wastage = await addDocument({
    kind: "adjustment",
    cause: "damaged",
    at: "13:00",
    lines: [{ productId: rice, quantity: -500 }],
  });
  const all = v.parse(documentList, await listDocuments(db(), ids.org, { branchId }));
  expect(all.items.map((d) => d.id)).toEqual([wastage, receipt]);
  expect(all.items[1]).toMatchObject({
    kind: "receipt",
    supplierName: "Accra Grains",
    cause: null,
    reference: null,
    lineCount: 2,
    totalCost: 1_035_000,
  });
  // A single-line adjustment carries its signed change, so the list can say "−0.5 kg".
  expect(all.items[0]).toMatchObject({
    kind: "adjustment",
    totalCost: null,
    change: { quantityThousandths: -500, baseUnit: expect.any(String) },
  });
  expect(all.items[1]).toMatchObject({ change: null });
  expect(all.counts).toEqual({ count: 0, receipt: 1, adjustment: 1 });
  const receipts = await listDocuments(db(), ids.org, { branchId, kind: "receipt" });
  expect(receipts.items.map((d) => d.id)).toEqual([receipt]);
  // The segments show every kind's count, whichever kind is open.
  expect(receipts.counts).toEqual(all.counts);

  const detail = v.parse(documentDetail, await readDocument(db(), ids.org, receipt));
  expect(detail.totalCost).toBe(1_035_000);
  expect(detail.lines).toEqual([
    expect.objectContaining({ productId: rice, quantityThousandths: 5_000, unitCost: 95_000 }),
    expect.objectContaining({ productId: tomatoes, quantityThousandths: 2_000, unitCost: 280_000 }),
  ]);
  await expect(readDocument(db(), ids.org, receipt, ids.otherProduct)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(readDocument(db(), ids.org, receipt, branchId)).resolves.toMatchObject({
    id: receipt,
  });
  await expect(readDocument(db(), ids.otherOrg, receipt)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("A receipt's total is its lines rounded to the pesewa and added, so printed lines sum to it", async () => {
  // 125.5 × 12.3456 = 1549.3728 -> 1549.37 and 3.333 × 9.50 = 31.6635 -> 31.66; the total is 1581.03, not 1581.0363.
  const receipt = await addDocument({
    kind: "receipt",
    at: "14:00",
    supplierId: await addSupplier("Rounding Supplies"),
    lines: [
      { productId: rice, quantity: 125_500, unitCost: 123_456 },
      { productId: tomatoes, quantity: 3_333, unitCost: 95_000 },
    ],
  });
  const detail = await readDocument(db(), ids.org, receipt);
  expect(detail.totalCost).toBe(15_810_300);
  const listed = await listDocuments(db(), ids.org, { branchId, kind: "receipt" });
  expect(listed.items.find((d) => d.id === receipt)?.totalCost).toBe(15_810_300);
});
