// Sales by day, hour, branch, cashier and tender over the report world: every figure is the golden sale's, summed
// the way the report says (net sales = gross less gross refunded; cash net of change), and reads the same once the
// days are rolled up.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { rollStoreDays } from "@shopper/core/reports";
import { ids } from "../../fixtures/sales/golden";
import { get } from "../../support/api/portal";
import { copied, figure, plan, reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
beforeAll(async () => {
  w = await reportWorld();
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const report = async (query: string) => {
  const reply = await get(w.owner.api, w.owner.cookie, `/reports/sales?${query}`);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
};
const GROSS = 0;
const CASH = 6;
const MOMO = 7;
const CARD = 8;
const CHANGE = 9;
const total = (indexes: number[], field: number) =>
  indexes.reduce((sum, i) => sum + figure(i, field), 0);
const day15 = [2, 3, 4, 5];

test("by day: every day of the range, empty ones as zeros, with refunds netted on the day they were made", async () => {
  const body = await report("from=2026-10-13&to=2026-10-15&by=day");
  expect(body.rows.map((row: any) => row.key)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  expect(body.rows[0]).toMatchObject({ transactions: 0, gross: 0, netSales: 0, basket: 0 });
  expect(body.rows[1]).toMatchObject({
    transactions: 2,
    gross: total([0, 1], GROSS),
    refunds: 0,
    netSales: total([0, 1], GROSS),
    basket: total([0, 1], GROSS) / 2,
  });
  const gross15 = total(day15, GROSS) + figure(copied.index, GROSS);
  expect(body.rows[2]).toMatchObject({
    transactions: 5,
    gross: gross15,
    refunds: 1,
    refundGross: w.refund.gross,
    netSales: gross15 - w.refund.gross,
  });
  expect(body.total).toMatchObject({
    transactions: 7,
    gross: total([0, 1], GROSS) + gross15,
    netSales: total([0, 1], GROSS) + gross15 - w.refund.gross,
  });
});

test("by hour: Accra hours in order, the refund in the hour it was made", async () => {
  const body = await report("from=2026-10-15&to=2026-10-15&by=hour");
  expect(body.rows.map((row: any) => [row.label, row.transactions, row.refunds])).toEqual([
    ["08:00", 1, 0],
    ["10:00", 1, 0],
    ["12:00", 2, 0],
    ["17:00", 1, 0],
    ["18:00", 0, 1],
  ]);
  expect(body.rows[2].gross).toBe(total([3, 4], GROSS));
});

test("by branch and by cashier: the copied sale stands apart under its branch and cashier names", async () => {
  const branches = await report("from=2026-10-14&to=2026-10-15&by=branch");
  const other = branches.rows.find((row: any) => row.key === w.otherBranch);
  expect(other).toMatchObject({
    label: "Other branch",
    transactions: 1,
    gross: figure(copied.index, GROSS),
  });
  const main = branches.rows.find((row: any) => row.key === ids.branch);
  expect(main).toMatchObject({ transactions: 6, gross: total([0, 1, ...day15], GROSS) });

  const cashiers = await report("from=2026-10-14&to=2026-10-15&by=cashier");
  expect(cashiers.rows.find((row: any) => row.key === w.second)).toMatchObject({
    label: "cashier",
    transactions: 1,
  });
  expect(cashiers.rows.find((row: any) => row.key === ids.cashier)?.transactions).toBe(6);
});

test("by tender: cash is net of change, each kind counts the sales that used it, the card refund comes off card", async () => {
  const body = await report("from=2026-10-15&to=2026-10-15&by=tender");
  const kind = (key: string) => body.rows.find((row: any) => row.key === key);
  const cash = [...day15, copied.index].reduce(
    (sum, i) => sum + figure(i, CASH) - figure(i, CHANGE),
    0,
  );
  expect(kind("cash")).toMatchObject({ transactions: 4, amount: cash, refunded: 0, net: cash });
  expect(kind("momo")).toMatchObject({ transactions: 2, amount: total(day15, MOMO) });
  expect(kind("card")).toMatchObject({
    transactions: 1,
    amount: total(day15, CARD),
    refunded: w.refund.total,
    net: total(day15, CARD) - w.refund.total,
  });
  // The kinds add up to what the sales took.
  const gross = total(day15, GROSS) + figure(copied.index, GROSS);
  const rounding = [...day15, copied.index].reduce((sum, i) => sum + figure(i, 5), 0);
  expect(body.total.amount).toBe(gross + rounding);
  // The split sale counts once in the total, not once per kind it used.
  expect(body.total.transactions).toBe(5);
  expect(plan.length).toBe(6);
});

test("the report reads the same after the nightly rollup", async () => {
  const live = await Promise.all(
    ["day", "hour", "branch", "cashier", "tender"].map((by) =>
      report(`from=2026-10-13&to=2026-10-15&by=${by}`),
    ),
  );
  await rollStoreDays(
    w.world.db,
    { ...w.world.command, actorId: undefined },
    {
      storeId: ids.store,
      through: "2026-10-15",
    },
  );
  const rolled = await Promise.all(
    ["day", "hour", "branch", "cashier", "tender"].map((by) =>
      report(`from=2026-10-13&to=2026-10-15&by=${by}`),
    ),
  );
  expect(rolled).toEqual(live);
});
