// Day 25 performance pass, run on request (`SHOPPER_PERF=1 vp test --run tests/perf`): p50 and p95 of each report
// over Day 22's year of data (tests/integration/reports/speed.test.ts holds the single-read 1.5 s budget in CI).
import { cpus } from "node:os";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { rollStoreDays } from "@shopper/core/reports";
import { ids } from "../fixtures/sales/golden";
import { reportWorld } from "../support/reports/world";
import { seedYear } from "../support/reports/year";

const RUNS = 7;
const year = "from=2025-10-15&to=2026-10-15";
const enabled = process.env.SHOPPER_PERF === "1";
let w: Awaited<ReturnType<typeof reportWorld>>;

beforeAll(async () => {
  if (!enabled) return;
  w = await reportWorld();
  await seedYear({
    templates: [w.sales[0]!.id, w.sales[1]!.id, w.sales[5]!.id],
    from: "2025-10-15",
    to: "2026-10-13",
    perDay: 300,
    otherBranch: w.otherBranch,
    second: w.second,
  });
  await rollStoreDays(
    w.world.db,
    { ...w.world.command, actorId: undefined },
    { storeId: ids.store, through: "2026-10-14" },
  );
}, 1_800_000);
afterAll(async () => {
  await w?.world.local.close();
});

describe.runIf(enabled)("report performance over a year", () => {
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
  ])("%s", async (path) => {
    const timings: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      const started = performance.now();
      const response = await w.owner.api.request(path, { headers: { cookie: w.owner.cookie! } });
      await response.arrayBuffer();
      expect(response.status).toBe(200);
      timings.push(performance.now() - started);
    }
    const sorted = [...timings].sort((a, b) => a - b);
    const at = (p: number) => Math.round(sorted[Math.min(RUNS - 1, Math.ceil(p * RUNS) - 1)]!);
    console.log(
      JSON.stringify({
        suite: "report",
        path,
        firstMs: Math.round(timings[0]!),
        p50Ms: at(0.5),
        p95Ms: at(0.95),
        cpu: cpus()[0]?.model,
      }),
    );
  });
});
