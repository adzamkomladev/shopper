// The statements read the journal and nothing else, so they must agree with it and with each other:
//   - the trial balance balances, and each account's row is its posted balance;
//   - profit and loss: net = income − expenses, income and expenses shown as positive amounts;
//   - the balance sheet: assets = liabilities + equity + earnings to date;
//   - an account's ledger runs from its opening balance to its closing balance, every line linked to its source;
//   - each levy payable equals what the tax summary says was charged less credited back;
//   - each statement downloads as CSV.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { taxSummary } from "@shopper/core/tax";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { get, portalOwner, type Portal } from "../../support/api/portal";
import { balances } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let books: Map<string, number>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Report Supplies"),
    on: "2026-10-01",
    at: "07:00",
    lines: [{ productId: products.standard.id, quantity: 500_000, unitCost: 40_000 }],
  });
  for (const scenario of tradingDay) await runGolden(world, scenario);
  books = await balances();
}, 600_000);
afterAll(async () => {
  await world?.local.close();
});

const read = async (path: string) => (await get(owner.api, owner.cookie, path)).body;
const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);

test("the trial balance balances and each row is the account's posted balance", async () => {
  const tb = await read("/ledger/reports/trial?asOf=2026-12-31");
  expect(tb.totals.debit).toBe(tb.totals.credit);
  expect(tb.totals.debit).toBeGreaterThan(0);
  for (const row of tb.rows)
    expect(row.debit - row.credit).toBe(books.get(row.systemKey ?? row.code) ?? 0);
  expect((await read("/ledger/reports/trial?asOf=2020-01-01")).rows).toEqual([]);
});

test("profit and loss nets income against expenses; the balance sheet balances with earnings", async () => {
  const pl = await read("/ledger/reports/profit?from=2026-10-01&to=2026-12-31");
  expect(pl.income.find((row: any) => row.systemKey === "sales").amount).toBe(-books.get("sales")!);
  expect(pl.expenses.find((row: any) => row.systemKey === "cogs").amount).toBe(books.get("cogs"));
  expect(pl.totals).toEqual({
    income: sum(pl.income),
    expenses: sum(pl.expenses),
    net: sum(pl.income) - sum(pl.expenses),
  });
  expect(pl.totals.net).toBeGreaterThan(0);

  const bs = await read("/ledger/reports/balance?asOf=2026-12-31");
  expect(bs.earnings).toBe(pl.totals.net);
  expect(bs.totals.assets).toBe(sum(bs.assets));
  expect(bs.totals.assets).toBe(sum(bs.liabilities) + sum(bs.equity) + bs.earnings);
  expect(bs.assets.find((row: any) => row.systemKey === "inventory").amount).toBe(
    books.get("inventory"),
  );
});

test("an account's ledger runs from opening to closing, each line linked to its source", async () => {
  const { accounts } = await read("/ledger/accounts");
  const drawer = accounts.find((row: any) => row.systemKey === "cash_drawer");
  expect(drawer.balance).toBe(books.get("cash_drawer"));
  const ledger = await read(`/ledger/accounts/${drawer.id}/lines?from=2026-10-01&to=2026-12-31`);
  expect(ledger.opening).toBe(0);
  expect(ledger.closing).toBe(books.get("cash_drawer"));
  expect(ledger.lines.at(-1).balance).toBe(ledger.closing);
  expect(ledger.lines.every((line: any) => line.source === "sale" && line.sourceId)).toBe(true);
  const later = await read(`/ledger/accounts/${drawer.id}/lines?from=2026-12-01&to=2026-12-31`);
  expect(later).toMatchObject({ opening: ledger.closing, closing: ledger.closing, lines: [] });
});

test("each levy payable is the tax summary's charged less credited back", async () => {
  const summary = await taxSummary(world.db, ids.org, {
    from: "2026-10-01",
    to: "2026-12-31",
    group: "day",
  });
  for (const levy of ["vat", "nhil", "getfund", "covid"] as const) {
    const owed = summary.rows.reduce(
      (sum, row) => sum + row.sales[levy] - row.creditNotes[levy],
      0,
    );
    expect(0 - (books.get(levy) ?? 0), levy).toBe(owed);
  }
  expect(-books.get("vat")!).toBeGreaterThan(0);
});

test("each statement downloads as CSV", async () => {
  for (const path of [
    "/ledger/reports/trial.csv?asOf=2026-12-31",
    "/ledger/reports/profit.csv?from=2026-10-01&to=2026-12-31",
    "/ledger/reports/balance.csv?asOf=2026-12-31",
  ]) {
    const response = await owner.api.request(path, { headers: { cookie: owner.cookie } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/csv/);
    expect((await response.text()).split("\n")[0]).toMatch(/^Code,Account/);
  }
});
