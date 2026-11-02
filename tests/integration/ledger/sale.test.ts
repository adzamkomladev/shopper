// Every accepted sale posts one balanced entry in the same transaction as the sale:
//   Dr what each tender took (cash net of change → drawers, MoMo and card → clearing, credit → customer accounts,
//      points → the loyalty liability); Cr sales ex-tax, each levy as the till snapshotted it, and cash rounding;
//   Dr cost of goods sold / Cr inventory at the product's last received cost (nothing when it was never costed);
//   Dr loyalty rewards / Cr loyalty points for the points the sale earned, at their point value.
// The whole golden trading day goes through the real sync path, so the books must equal the golden figures.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { lineTotal, money } from "@shopper/money";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { expected, fields } from "../../fixtures/sales/golden/expected";
import { products } from "../../fixtures/sales/golden/references";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { api } from "../../support/till/server";
import { pushEvents } from "../../support/till/requests";
import { chainValid } from "../../support/customers/ledger";
import { balances, entriesOf, trialBalanceZero } from "../../support/ledger/books";

const UNIT_COST = 40_000; // GHS 4.00 per unit of the standard product
let world: Awaited<ReturnType<typeof goldenWorld>>;
const sold: NonNullable<Awaited<ReturnType<typeof runGolden>>>[] = [];

beforeAll(async () => {
  world = await goldenWorld();
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Ledger Supplies"),
    on: "2026-10-01",
    at: "07:00",
    lines: [{ productId: products.standard.id, quantity: 500_000, unitCost: UNIT_COST }],
  });
  for (const scenario of tradingDay) {
    const sale = await runGolden(world, scenario);
    if (sale) sold.push(sale);
  }
}, 600_000);
afterAll(async () => {
  await world?.local.close();
});

const golden = (field: (typeof fields)[number]) =>
  expected.reduce((sum, row) => sum + row[fields.indexOf(field)]!, 0);

test("the day's sales, levies, tenders and rounding are in the books to the unit", async () => {
  const books = await balances({ source: "sale" });
  const levies = golden("vat") + golden("nhil") + golden("getfund");
  expect(books.get("vat")).toBe(-golden("vat"));
  expect(books.get("nhil")).toBe(-golden("nhil"));
  expect(books.get("getfund")).toBe(-golden("getfund"));
  expect(books.get("covid") ?? 0).toBe(0);
  expect(books.get("sales")).toBe(-(golden("gross") - levies));
  expect(books.get("cash_drawer")).toBe(golden("cash") - golden("change"));
  expect(books.get("momo_clearing")).toBe(golden("momo"));
  expect(books.get("card_clearing")).toBe(golden("card"));
  expect(books.get("rounding") ?? 0).toBe(-golden("rounding"));
  expect(await trialBalanceZero()).toBe(true);
});

test("each sale posts one entry on its day; a fully discounted one posts only the goods it gave away", async () => {
  for (const sale of sold) {
    const entries = await entriesOf("sale", sale.id);
    expect(entries).toHaveLength(1);
    if (sale.total === 0)
      expect(Object.keys(entries[0]!.lines).sort()).toEqual(["cogs", "inventory"]);
    expect(entries[0]!.posted_on).toBe(sale.deviceTime.slice(0, 10));
    expect(entries[0]!.memo).toContain(sale.receiptNumber ?? "");
  }
});

test("goods sold leave inventory at their last received cost; uncosted goods post no cost", async () => {
  const units = sold
    .flatMap((sale) => sale.lines)
    .filter((line) => line.productId === products.standard.id)
    .map((line) => lineTotal(money(UNIT_COST), line.tax.quantityThousandths));
  const cost = units.reduce((sum, value) => sum + value, 0);
  const books = await balances({ source: "sale" });
  expect(cost).toBeGreaterThan(0);
  expect(books.get("cogs")).toBe(cost);
  expect(books.get("inventory")).toBe(-cost);
  const uncosted = sold.find((sale) =>
    sale.lines.every((line) => line.productId !== products.standard.id),
  )!;
  expect(Object.keys((await entriesOf("sale", uncosted.id))[0]!.lines)).not.toContain("cogs");
});

test("a replayed upload posts nothing more, and the audit chain still verifies", async () => {
  const first = sold[0]!;
  const before = await entriesOf("sale", first.id);
  const response = await pushEvents(
    api,
    [{ v: 7, type: "sale.recorded", sale: first }],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(response.status).toBe(200);
  expect(await entriesOf("sale", first.id)).toEqual(before);
  const { rows } = await world.db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM journal_entry WHERE source = 'sale'`,
  );
  expect(rows[0]!.count).toBe(sold.length);
  expect(await chainValid()).toBe(true);
});
