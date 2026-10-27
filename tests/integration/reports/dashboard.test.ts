// The dashboard for 15 Oct against 14 Oct over the report world: KPIs with yesterday and the change, the day's top
// products, its tender mix net of change and refunds, and both days hour by hour.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { products } from "../../fixtures/sales/golden/references";
import { get } from "../../support/api/portal";
import { copied, figure, reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
let body: Record<string, any>;
beforeAll(async () => {
  w = await reportWorld();
  const reply = await get(w.owner.api, w.owner.cookie, "/reports/dashboard?day=2026-10-15");
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  body = reply.body;
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const GROSS = 0;
const NET = 1;
const sum = (indexes: number[], field: number) => indexes.reduce((s, i) => s + figure(i, field), 0);
const today = [2, 3, 4, 5, copied.index];
const yesterday = [0, 1];

test("KPIs: today against yesterday, with the change in basis points", async () => {
  const net = sum(today, GROSS) - w.refund.gross;
  expect(body).toMatchObject({ day: "2026-10-15", yesterday: "2026-10-14" });
  expect(body.kpis.netSales).toEqual({
    value: net,
    yesterday: sum(yesterday, GROSS),
    changeBps: Math.round(((net - sum(yesterday, GROSS)) * 10_000) / sum(yesterday, GROSS)),
  });
  expect(body.kpis.transactions).toMatchObject({ value: 5, yesterday: 2, changeBps: 15_000 });
  expect(body.kpis.basket).toMatchObject({
    value: Math.round(sum(today, GROSS) / 5),
    yesterday: sum(yesterday, GROSS) / 2,
  });
  expect(body.kpis.itemsPerBasket).toMatchObject({ value: 1_000, yesterday: 1_000, changeBps: 0 });
  expect(body.kpis.refunds).toMatchObject({ value: w.refund.gross, yesterday: 0, changeBps: null });
  // Margin: the copy at the other branch is uncosted, so its revenue counts with no cost against it.
  const revenue = sum(today, NET) - figure(2, NET);
  expect(body.kpis.margin.value).toBe(revenue - 3 * 50_000);
  expect(body.kpis.margin.yesterday).toBe(sum(yesterday, NET) - 2 * 50_000);
});

test("top products and tender mix for the day", async () => {
  expect(body.top).toEqual([
    {
      productId: products.standard.id,
      name: expect.any(String),
      netSales: sum(today, GROSS) - w.refund.gross,
      quantity: 4_000,
    },
  ]);
  const kinds = Object.fromEntries(body.tenders.map((t: any) => [t.kind, t]));
  const cashIn = [2, 4, 5, copied.index].reduce((s, i) => s + figure(i, 6) - figure(i, 9), 0);
  expect(kinds.cash).toEqual({ kind: "cash", transactions: 4, net: cashIn });
  expect(kinds.momo).toEqual({ kind: "momo", transactions: 2, net: figure(3, 7) + figure(4, 7) });
  expect(kinds.card).toEqual({ kind: "card", transactions: 1, net: figure(4, 8) - w.refund.total });
  expect(body.tenders[0].kind).toBe("cash");
});

test("sales by hour: 24 Accra hours for both days, the refund off the hour it was made", async () => {
  expect(body.hours).toHaveLength(24);
  const at = (hour: number) => body.hours[hour];
  expect(at(9)).toEqual({ hour: 9, today: 0, yesterday: figure(0, GROSS) });
  expect(at(15)).toEqual({ hour: 15, today: 0, yesterday: figure(1, GROSS) });
  expect(at(8).today).toBe(figure(2, GROSS));
  expect(at(10).today).toBe(figure(copied.index, GROSS));
  expect(at(12).today).toBe(figure(3, GROSS) + figure(4, GROSS));
  expect(at(18).today).toBe(-w.refund.gross);
  expect(body.hours.reduce((s: number, h: any) => s + h.today, 0)).toBe(body.kpis.netSales.value);
});
