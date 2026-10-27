// Notion Day 22: "Rollups equal raw aggregates for the fixture month". Every grain the reports read (sales by
// hour and cashier, tenders, products) comes out the same whether the month is folded live from the sales or read
// from the nightly rollup; a late sale makes its day stale until the next rollup; rolling again changes nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, asc, eq, sql } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { rollStoreDays } from "@shopper/core/reports";
import { auditLog, reportProduct, storeDay } from "@shopper/db-pg";
import { mulQty, money } from "@shopper/money";
import { ids } from "../../fixtures/sales/golden";
import { products } from "../../fixtures/sales/golden/references";
import { runGolden } from "../../support/sales/golden/run";
import {
  dayExpected,
  days,
  everyGrain,
  fixtureMonth,
  from,
  refundDays,
  scenario,
  to,
  type World,
} from "../../support/reports/month";

let world: World;
beforeAll(async () => {
  world = (await fixtureMonth()).world;
}, 600_000);
afterAll(async () => {
  await world?.local.close();
});

const roll = (through: string) =>
  rollStoreDays(
    world.db,
    { ...world.command, actorId: undefined },
    { storeId: ids.store, through },
  );
const sum = (rows: Record<string, string>[], column: string) =>
  rows.reduce((total, row) => total + Number(row[column]), 0);

test("rollups equal raw aggregates for the fixture month", async () => {
  const live = await everyGrain(world);
  const golden = dayExpected();
  const month = days(from, to).length;
  // The live fold itself adds up to the golden figures of every fixture day.
  expect(sum(live.sales, "sales")).toBe(5 * month);
  expect(sum(live.sales, "gross")).toBe(golden[0]! * month);
  expect(sum(live.sales, "net")).toBe(golden[1]! * month);
  expect(sum(live.sales, "tax")).toBe((golden[2]! + golden[3]! + golden[4]!) * month);
  expect(sum(live.sales, "rounding")).toBe(golden[5]! * month);
  expect(sum(live.sales, "refunds")).toBe(refundDays.length);
  const tender = (kind: string) =>
    sum(
      live.tenders.filter((row) => row.kind === kind),
      "amount",
    );
  expect(tender("cash")).toBe((golden[6]! - golden[9]!) * month);
  expect(tender("momo")).toBe(golden[7]! * month);
  expect(tender("card")).toBe(golden[8]! * month);

  const rolled = await roll(to);
  expect(rolled.days).toEqual(days(from, to));
  const stale = await world.db
    .select()
    .from(storeDay)
    .where(and(eq(storeDay.orgId, ids.org), sql`${storeDay.rolledAt} IS NULL`));
  expect(stale).toEqual([]);
  expect(await everyGrain(world)).toEqual(live);
  // And the rows really come from the rollup tables now.
  const stored = await world.db.execute<{ n: string }>(
    sql`SELECT count(*) AS n FROM report_sales WHERE org_id = ${ids.org}`,
  );
  expect(Number(stored.rows[0]!.n)).toBe(live.sales.length);
});

test("each day's rice costs the latest receipt on or before it, and days before any receipt are uncosted", async () => {
  const rows = await world.db
    .select()
    .from(reportProduct)
    .where(and(eq(reportProduct.orgId, ids.org), eq(reportProduct.productId, products.standard.id)))
    .orderBy(asc(reportProduct.day));
  const on = (day: string) => rows.find((row) => row.day === day)!;
  expect(on("2026-09-19")).toMatchObject({ cost: 0, uncosted: on("2026-09-19").quantity });
  expect(on("2026-09-20")).toMatchObject({
    cost: mulQty(money(50_000), on("2026-09-20").quantity),
    uncosted: 0,
  });
  expect(on("2026-09-30").cost).toBe(mulQty(money(50_000), on("2026-09-30").quantity));
  expect(on("2026-10-01").cost).toBe(mulQty(money(60_000), on("2026-10-01").quantity));
  // The refunded unit on 1 Oct goes back at that day's cost.
  expect(on("2026-10-01").refundCost).toBe(mulQty(money(60_000), 1_000));
});

test("a sale uploaded late makes its rolled day stale; it counts at once and the next rollup takes it in", async () => {
  const before = await everyGrain(world, { from: "2026-10-03", to: "2026-10-03" });
  await runGolden(world, scenario("manual card"), new Date("2026-10-03T20:15:00.000Z"));
  const [day] = await world.db
    .select()
    .from(storeDay)
    .where(and(eq(storeDay.orgId, ids.org), eq(storeDay.day, "2026-10-03")));
  expect(day?.rolledAt).toBeNull();
  const live = await everyGrain(world, { from: "2026-10-03", to: "2026-10-03" });
  expect(sum(live.sales, "sales")).toBe(sum(before.sales, "sales") + 1);
  expect(sum(live.sales, "gross")).toBe(sum(before.sales, "gross") + 120_000);

  expect((await roll(to)).days).toEqual(["2026-10-03"]);
  expect(await everyGrain(world, { from: "2026-10-03", to: "2026-10-03" })).toEqual(live);
});

test("rolling again rolls nothing and changes nothing; each rollup is audited on an unbroken chain", async () => {
  const before = await everyGrain(world);
  expect((await roll(to)).days).toEqual([]);
  expect(await everyGrain(world)).toEqual(before);
  const entries = await world.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  expect(entries.filter((row) => row.command === "report.rollup")).toHaveLength(3);
  expect(await verifyChain(entries.filter((row) => row.chainSeq !== null))).toMatchObject({
    valid: true,
  });
});
