// Slice 3: search over a 20,000 product till stays interactive (< 50 ms per query), cold and warm.
import { cpus } from "node:os";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { projectProducts, searchCatalogue } from "@shopper/core/till";
import { code, ids, product, tempTill, type ProductRow } from "../../../support/till/catalogue";

const COUNT = 20_000;
const BUDGET_MS = 50;
const kinds = [
  "Rice",
  "Milk",
  "Chocolate",
  "Tomato",
  "Biscuit",
  "Soap",
  "Sugar",
  "Tea",
  "Oil",
  "Juice",
];
const brands = [
  "Golden",
  "Royal",
  "Fresh",
  "Mama",
  "Kasapreko",
  "Ghana",
  "Premium",
  "Value",
  "Tropical",
  "Delight",
];
const forms = [
  "Basmati",
  "Evaporated",
  "Dark",
  "Paste",
  "Cream",
  "Liquid",
  "Brown",
  "Green",
  "Palm",
  "Orange",
];
const sizes = ["250g", "500g", "1kg", "2kg", "5kg", "330ml", "500ml", "1l", "2l", "6 pack"];
const ean = (n: number) => `${n % 7 === 0 ? "000" : "599"}${String(n).padStart(10, "0")}`;

const catalogue: ProductRow[] = Array.from({ length: COUNT }, (_, n) =>
  product({
    sku: `SKU-${String(n).padStart(6, "0")}`,
    name: `${brands[n % 10]} ${forms[(n >> 3) % 10]} ${kinds[(n >> 6) % 10]} ${sizes[(n >> 9) % 10]} ${n}`,
    barcodes: n % 5 === 0 ? [code(ean(n)), code(ean(n + COUNT), 12_000)] : [code(ean(n))],
  }),
);

type Query = { label: string; query: string; first?: string };
const at = (n: number) => catalogue[n]!;
const queries: Query[] = [
  ...[3, 4_321, 10_000, 15_555, 19_999].map((n) => ({
    label: "barcode",
    query: ean(n),
    first: at(n).id,
  })),
  ...[7, 1_234, 8_888, 12_345, 19_998].map((n) => ({
    label: "sku",
    query: at(n).sku,
    first: at(n).id,
  })),
  ...["ric", "milk", "choc", "tom", "bisc"].map((query) => ({ label: "prefix", query })),
  ...[
    "golden rice 1kg",
    "royal dark choc",
    "fresh milk 500ml",
    "mama cream tomato",
    "tea green 2l",
  ].map((query) => ({ label: "tokens", query })),
];

let till: Awaited<ReturnType<typeof tempTill>>;
let seedMs = 0;
beforeAll(async () => {
  till = await tempTill();
  const started = performance.now();
  await till.database.transaction((tx) => projectProducts(tx, ids.org, catalogue));
  seedMs = performance.now() - started;
}, 120_000);
afterAll(() => till?.close());

const run = async ({ query, first }: Query) => {
  const started = performance.now();
  const rows = await searchCatalogue(till.database, { orgId: ids.org, query });
  return { ms: performance.now() - started, rows, first };
};
const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;

test("20,000 products: every barcode, SKU, prefix and multi-token query answers under 50 ms", async () => {
  const timings: { label: string; query: string; ms: number }[] = [];
  for (const query of queries) {
    const { ms, rows, first } = await run(query);
    expect(rows.length, query.query).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(50);
    if (first) expect(rows[0]!.productId, query.query).toBe(first);
    timings.push({ label: query.label, query: query.query, ms });
  }
  const sorted = timings.map((t) => t.ms).sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      suite: "till catalogue search",
      products: COUNT,
      seedMs: Math.round(seedMs),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model,
      queries: timings.length,
      p50Ms: +percentile(sorted, 0.5).toFixed(2),
      p95Ms: +percentile(sorted, 0.95).toFixed(2),
      maxMs: +sorted.at(-1)!.toFixed(2),
      slowest: timings.sort((a, b) => b.ms - a.ms).slice(0, 3),
    }),
  );
  for (const { query, ms } of timings)
    expect(ms, `${query} took ${ms.toFixed(1)} ms`).toBeLessThan(BUDGET_MS);
});

test("the first query after reopening the database is also under 50 ms", async () => {
  await till.restart();
  const cold = await run({ label: "cold", query: "golden rice" });
  const warm = await run({ label: "warm", query: "golden rice" });
  console.log(
    JSON.stringify({
      suite: "till catalogue search cold",
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model,
      coldMs: +cold.ms.toFixed(2),
      warmMs: +warm.ms.toFixed(2),
    }),
  );
  expect(cold.rows.length).toBeGreaterThan(0);
  expect(cold.ms, `cold query took ${cold.ms.toFixed(1)} ms`).toBeLessThan(BUDGET_MS);
});
