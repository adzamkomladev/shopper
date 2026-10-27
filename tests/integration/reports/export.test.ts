// Every report as CSV and Excel holds the JSON report's rows (then its total), and the accountant's journal is a
// balanced entry per day and branch whose levies are the tax summary's. Cash-rounded sales on 16 Oct put cash
// rounding in the books both ways.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import * as XLSX from "xlsx";
import { toDecimal, type Money } from "@shopper/money";
import { taxSummary } from "@shopper/core/tax";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { ids } from "../../fixtures/sales/golden";
import { get } from "../../support/api/portal";
import { runGolden } from "../../support/sales/golden/run";
import { reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
beforeAll(async () => {
  w = await reportWorld();
  for (const [name, at] of [
    ["cash rounds up", "2026-10-16T09:00:00.000Z"],
    ["cash rounds down", "2026-10-16T10:00:00.000Z"],
  ] as const)
    await runGolden(
      w.world,
      tradingDay.find((sale) => sale.name === name)!,
      new Date(at),
    );
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const range = "from=2026-10-13&to=2026-10-16";
const fetchRaw = (path: string) =>
  w.owner.api.request(path, { headers: { cookie: w.owner.cookie! } });
const json = async (path: string) => {
  const reply = await get(w.owner.api, w.owner.cookie, path);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
};

const reports = [
  ["sales", `${range}&by=day`, 1],
  ["sales", `${range}&by=hour`, 1],
  ["sales", `${range}&by=branch`, 1],
  ["sales", `${range}&by=cashier`, 1],
  ["sales", `${range}&by=tender`, 1],
  ["products", range, 1],
  ["branches", range, 1],
  ["stock/dead", "days=30&on=2026-12-20", 1],
  ["journal", range, 1],
] as const;

test.each(reports)(
  "%s?%s exports its rows and total to CSV and Excel",
  async (name, query, totals) => {
    const body = await json(`/reports/${name}?${query}`);
    const lines = body.rows.length + totals;
    expect(body.rows.length).toBeGreaterThan(0);

    const csv = await fetchRaw(`/reports/${name}/export.csv?${query}`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(csv.headers.get("content-disposition")).toMatch(
      /^attachment; filename="[a-z0-9-]+\.csv"$/,
    );
    const csvRows = (await csv.text()).trimEnd().split("\n");
    expect(csvRows).toHaveLength(1 + lines);

    const xlsx = await fetchRaw(`/reports/${name}/export.xlsx?${query}`);
    expect(xlsx.status).toBe(200);
    const book = XLSX.read(new Uint8Array(await xlsx.arrayBuffer()), { type: "array" });
    const sheet = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]!]!, {
      header: 1,
    });
    expect(sheet).toHaveLength(1 + lines);
    expect(sheet[0]).toEqual(csvRows[0]!.split(","));
  },
);

test("the dashboard exports its six KPIs against yesterday", async () => {
  const csv = await (await fetchRaw("/reports/dashboard/export.csv?day=2026-10-15")).text();
  const rows = csv.trimEnd().split("\n");
  expect(rows[0]).toBe("Measure,2026-10-15,2026-10-14,Change %");
  expect(rows).toHaveLength(7);
  const kpis = (await json("/reports/dashboard?day=2026-10-15")).kpis;
  expect(rows[1]).toBe(
    `Net sales,${toDecimal(kpis.netSales.value as Money, 4)},${toDecimal(kpis.netSales.yesterday as Money, 4)},${(kpis.netSales.changeBps / 100).toFixed(2)}`,
  );
});

test("CSV amounts are the report's to the 1/10000 cedi, and Excel holds them as numbers", async () => {
  const body = await json(`/reports/sales?${range}&by=day`);
  const csv = (await (await fetchRaw(`/reports/sales/export.csv?${range}&by=day`)).text())
    .trimEnd()
    .split("\n");
  expect(csv.at(-1)!.split(",").slice(0, 4)).toEqual([
    "Total",
    String(body.total.transactions),
    (body.total.items / 1000).toFixed(3),
    toDecimal(body.total.gross as Money, 4),
  ]);
  const book = XLSX.read(
    new Uint8Array(
      await (await fetchRaw(`/reports/sales/export.xlsx?${range}&by=day`)).arrayBuffer(),
    ),
    { type: "array", cellNF: true },
  );
  const sheet = book.Sheets[book.SheetNames[0]!]!;
  const last = 1 + body.rows.length + 1;
  expect(sheet[`D${last}`]).toMatchObject({ t: "n", v: body.total.gross / 10_000, z: "#,##0.00" });
});

test("the journal balances per day and branch, and its levies are the tax summary's", async () => {
  const journal = await json(`/reports/journal?${range}`);
  type Line = { day: string; branchId: string; account: string; debit: number; credit: number };
  const entries = new Map<string, Line[]>();
  for (const row of journal.rows as Line[])
    entries.set(`${row.day}|${row.branchId}`, [
      ...(entries.get(`${row.day}|${row.branchId}`) ?? []),
      row,
    ]);
  expect(entries.size).toBe(4);
  for (const [key, lines] of entries) {
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = lines.reduce((sum, line) => sum + line.credit, 0);
    expect(debit, key).toBe(credit);
    expect(debit, key).toBeGreaterThan(0);
  }
  expect(journal.total.debit).toBe(journal.total.credit);

  const summary = await taxSummary(w.world.db, ids.org, {
    from: "2026-10-13",
    to: "2026-10-16",
    group: "day",
  });
  const levies = {
    VAT: "vat",
    NHIL: "nhil",
    "GETFund levy": "getfund",
    "COVID-19 levy": "covid",
  } as const;
  for (const [key, lines] of entries) {
    const [day, branchId] = key.split("|");
    const rows = summary.rows.filter((row) => row.period === day && row.branchId === branchId);
    for (const [account, part] of Object.entries(levies)) {
      const owed = rows.reduce((sum, row) => sum + row.sales[part] - row.creditNotes[part], 0);
      const line = lines.find((l) => l.account === account);
      expect((line?.credit ?? 0) - (line?.debit ?? 0), `${key} ${account}`).toBe(owed);
    }
  }
  // 16 Oct: one sale rounded up by 500 and one down by 400 net to a 100 credit.
  const rounding = journal.rows.find(
    (row: any) => row.day === "2026-10-16" && row.account === "Cash rounding",
  );
  expect(rounding).toMatchObject({ debit: 0, credit: 100 });
  // The card refund on 15 Oct is credited back to card and debited to sales returns.
  const returns = journal.rows.find(
    (row: any) => row.day === "2026-10-15" && row.account === "Sales returns",
  );
  expect(returns.debit).toBeGreaterThan(0);
});

test("exports honour branch scope like the reports", async () => {
  expect(
    (await fetchRaw(`/reports/journal/export.csv?${range}&branchId=${w.otherBranch}`)).status,
  ).toBe(200);
  const anonymous = await w.owner.api.request(`/reports/journal/export.csv?${range}`);
  expect(anonymous.status).toBe(401);
});
