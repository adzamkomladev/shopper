// The reports fixture month: golden sales rung up on the golden till and accepted through the sync API on every
// day from 16 Sep to 15 Oct 2026, at three Accra hours, with refunds on three days and two costed receipts.
import { sql } from "drizzle-orm";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { inSnapshot, reportSource, type ReportRange } from "@shopper/core/reports";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { expected } from "../../fixtures/sales/golden/expected";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../sales/golden/setup";
import { runGolden } from "../sales/golden/run";
import { postRefund, refundEvent } from "../sales/refunds";
import { addDocument, addSupplier } from "../stock/seed";

export type World = Awaited<ReturnType<typeof goldenWorld>>;
export const from = "2026-09-16";
export const to = "2026-10-15";
export const scenarios = [
  "cash with change",
  "exact MoMo",
  "three way split",
  "line discount",
  "card cash change",
] as const;
const hours = ["08", "12", "17"];
export const refundDays = ["2026-09-20", "2026-10-01", "2026-10-10"];
/** Rice costs 5 GHS from 20 Sep and 6 GHS from 1 Oct: earlier days have no cost. */
export const receipts = [
  { on: "2026-09-20", unitCost: 50_000 },
  { on: "2026-10-01", unitCost: 60_000 },
];

export async function fixtureMonth() {
  const world = await goldenWorld({ since: `${from}T00:00:00.000Z` });
  const supplierId = await addSupplier("Month Supplies");
  for (const receipt of receipts)
    await addDocument({
      kind: "receipt",
      supplierId,
      on: receipt.on,
      at: "06:00",
      lines: [{ productId: products.standard.id, quantity: 500_000, unitCost: receipt.unitCost }],
    });
  const sales: SaleSnapshot[] = [];
  for (const [d, day] of days(from, to).entries())
    for (const [i, name] of scenarios.entries()) {
      const at = new Date(
        `${day}T${hours[(d + i) % hours.length]}:${String(i).padStart(2, "0")}:00.000Z`,
      );
      sales.push((await runGolden(world, scenario(name), at))!);
    }
  for (const day of refundDays) {
    const sold = sales.find((s) => s.deviceTime.startsWith(day) && s.tenders.length === 1)!;
    const event = refundEvent(world, sold, [{ line: 0, before: 0, after: 1_000 }]);
    event.refund.deviceTime = `${day}T19:30:00.000Z`;
    const posted = await postRefund(event, world.session.proof);
    if (!posted.body.accepted) throw new Error(`Refund on ${day} was refused`);
  }
  return { world, sales };
}

/** The golden expected figures of one fixture day: [gross, base, nhil, getfund, vat, rounding, cash, momo, card, change]. */
export const dayExpected = () =>
  scenarios
    .map((name) => expected[tradingDay.findIndex((s) => s.name === name)]!)
    .reduce((sum, row) => sum.map((value, i) => value + row[i]!), Array(10).fill(0) as number[]);

export const scenario = (name: string) => tradingDay.find((s) => s.name === name)!;

export function days(start: string, end: string) {
  const out: string[] = [];
  for (
    let at = Date.parse(`${start}T00:00:00Z`);
    at <= Date.parse(`${end}T00:00:00Z`);
    at += 86_400_000
  )
    out.push(new Date(at).toISOString().slice(0, 10));
  return out;
}

export const range = (over: Partial<ReportRange> = {}): ReportRange => ({
  orgId: ids.org,
  from,
  to,
  ...over,
});

/** Every row of every report grain over the range, keyed and sorted, as plain numbers for comparison. */
export async function everyGrain(world: World, over: Partial<ReportRange> = {}) {
  const read = async (grain: "sales" | "tenders" | "products", key: string) => {
    const { rows } = await inSnapshot(world.db, async (tx) =>
      tx.execute<Record<string, unknown>>(
        sql`SELECT * FROM (${await reportSource(tx, grain, range(over))}) x ORDER BY ${sql.raw(key)}`,
      ),
    );
    return rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)])),
    );
  };
  return {
    sales: await read("sales", "day, branch_id, hour, cashier_id"),
    tenders: await read("tenders", "day, branch_id, kind"),
    products: await read("products", "day, branch_id, product_id"),
  };
}
