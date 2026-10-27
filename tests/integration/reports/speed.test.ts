// Day 22's bar: every report answers in under 1.5 s over a year of data. About 110 000 sales at two branches, every
// day but today rolled up by the real rollup (today folds live, as it does at the till's close), each report and
// export read once through the API, and the figures still equal a direct aggregate of the sales.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { rollStoreDays } from "@shopper/core/reports";
import { ids } from "../../fixtures/sales/golden";
import { reportWorld } from "../../support/reports/world";
import { seedYear } from "../../support/reports/year";

const BUDGET_MS = 1_500;
const year = "from=2025-10-15&to=2026-10-15";
let w: Awaited<ReturnType<typeof reportWorld>>;

beforeAll(async () => {
  w = await reportWorld();
  await seedYear({
    // Cash with change, manual card and line discount: tenders that need no MoMo payment of their own.
    templates: [w.sales[0]!.id, w.sales[1]!.id, w.sales[5]!.id],
    from: "2025-10-15",
    to: "2026-10-13",
    perDay: 300,
    otherBranch: w.otherBranch,
    second: w.second,
  });
  const rolled = await rollStoreDays(
    w.world.db,
    { ...w.world.command, actorId: undefined },
    { storeId: ids.store, through: "2026-10-14" },
  );
  expect(rolled.days.length).toBeGreaterThanOrEqual(365);
  // Warm the API and the connection once, as a portal that is already open would be.
  await w.owner.api.request("/reports/dashboard?day=2026-10-15", {
    headers: { cookie: w.owner.cookie! },
  });
}, 900_000);
afterAll(async () => {
  await w?.world.local.close();
});

test.each([
  "/reports/dashboard?day=2026-10-15",
  `/reports/sales?${year}&by=day`,
  `/reports/sales?${year}&by=hour`,
  `/reports/sales?${year}&by=branch`,
  `/reports/sales?${year}&by=cashier`,
  `/reports/sales?${year}&by=tender`,
  `/reports/products?${year}`,
  `/reports/branches?${year}`,
  "/reports/stock/dead?days=90&on=2026-10-15",
  `/reports/journal?${year}`,
  `/reports/sales/export.xlsx?${year}&by=day`,
  `/reports/journal/export.csv?${year}`,
])("%s answers within 1.5 s over the year", async (path) => {
  const started = performance.now();
  const response = await w.owner.api.request(path, { headers: { cookie: w.owner.cookie! } });
  await response.arrayBuffer();
  const took = performance.now() - started;
  expect(response.status).toBe(200);
  expect(took, `${path} took ${Math.round(took)} ms`).toBeLessThan(BUDGET_MS);
});

test("the year's totals are the sales' own", async () => {
  const response = await w.owner.api.request(`/reports/sales?${year}&by=branch`, {
    headers: { cookie: w.owner.cookie! },
  });
  const body = (await response.json()) as { total: { transactions: number; gross: number } };
  const [raw] = (
    await w.world.db.execute<{ sales: string; gross: string }>(sql`
      SELECT count(*)::text AS sales, sum((payload->'totals'->>'gross')::bigint)::text AS gross
      FROM sale WHERE org_id = ${ids.org}`)
  ).rows;
  expect(body.total.transactions).toBe(Number(raw!.sales));
  expect(body.total.gross).toBe(Number(raw!.gross));
  expect(body.total.transactions).toBeGreaterThan(100_000);
});
