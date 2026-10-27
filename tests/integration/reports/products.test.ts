// Product performance, margin and dead stock over the report world. The standard product sold six times at the
// main branch (one refunded) and once at the other branch, whose stock was never costed. Margin costs each unit
// at the last costed receipt on or before its sale day, so a later receipt changes nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { product } from "@shopper/db-pg";
import { rollStoreDays } from "@shopper/core/reports";
import { ids } from "../../fixtures/sales/golden";
import { products } from "../../fixtures/sales/golden/references";
import { get } from "../../support/api/portal";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { postRefund, refundEvent } from "../../support/sales/refunds";
import { runGolden } from "../../support/sales/golden/run";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { copied, figure, reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
beforeAll(async () => {
  w = await reportWorld();
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const read = async (path: string) => {
  const reply = await get(w.owner.api, w.owner.cookie, path);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
};
const NET = 1;
const COST = 50_000;
const mainNets = [0, 1, 2, 3, 4, 5].reduce((sum, i) => sum + figure(i, NET), 0);
const refundedNet = figure(2, NET);

test("margin at the main branch: revenue ex-tax net of the refund, less the receipt cost of what stayed sold", async () => {
  const body = await read(`/reports/products?from=2026-10-14&to=2026-10-15&branchId=${ids.branch}`);
  expect(body.rows).toHaveLength(1);
  const revenue = mainNets - refundedNet;
  expect(body.rows[0]).toMatchObject({
    productId: products.standard.id,
    quantity: 6_000,
    refundQuantity: 1_000,
    revenue,
    cost: 5 * COST,
    margin: revenue - 5 * COST,
    costed: "all",
  });
  expect(body.total).toMatchObject({ revenue, margin: revenue - 5 * COST, uncosted: 0 });
});

test("the other branch never costed its stock: its unit counts as uncosted and the product says so", async () => {
  const body = await read("/reports/products?from=2026-10-14&to=2026-10-15");
  const revenue = mainNets - refundedNet + figure(copied.index, NET);
  expect(body.rows[0]).toMatchObject({
    quantity: 7_000,
    revenue,
    cost: 5 * COST,
    costed: "some",
  });
  expect(body.total.uncosted).toBe(1);
  const other = await read(
    `/reports/products?from=2026-10-14&to=2026-10-15&branchId=${w.otherBranch}`,
  );
  expect(other.rows[0]).toMatchObject({
    quantity: 1_000,
    cost: 0,
    costed: "none",
    marginBps: 10_000,
  });
});

test("a receipt after the sale days leaves their margin alone", async () => {
  const before = await read(
    `/reports/products?from=2026-10-14&to=2026-10-15&branchId=${ids.branch}`,
  );
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Later Supplies"),
    on: "2026-10-16",
    at: "07:00",
    lines: [{ productId: products.standard.id, quantity: 10_000, unitCost: 90_000 }],
  });
  expect(
    await read(`/reports/products?from=2026-10-14&to=2026-10-15&branchId=${ids.branch}`),
  ).toEqual(before);
});

test("dead stock: on hand with no sale in the window, never-sold counts, the window is 30, 60 or 90 days", async () => {
  const dead = (days: number, on: string) =>
    read(`/reports/stock/dead?days=${days}&on=${on}&branchId=${ids.branch}`);
  // The standard product last sold on 15 Oct.
  expect((await dead(30, "2026-10-15")).rows.map((row: any) => row.productId)).not.toContain(
    products.standard.id,
  );
  const late = await dead(60, "2026-12-20");
  const standard = late.rows.find((row: any) => row.productId === products.standard.id);
  expect(standard).toMatchObject({ lastSale: "2026-10-15", unitCost: 90_000 });
  expect(standard.value).toBe(Math.round((90_000 * standard.onHand) / 1000));
  expect(late.total).toBe(late.rows.reduce((sum: number, row: any) => sum + row.value, 0));
  expect((await dead(30, "2026-12-20")).rows.map((row: any) => row.productId)).toContain(
    products.standard.id,
  );
  expect((await dead(90, "2026-12-20")).rows.map((row: any) => row.productId)).not.toContain(
    products.standard.id,
  );
  expect((await get(w.owner.api, w.owner.cookie, "/reports/stock/dead?days=45")).status).toBe(400);
  // As of 13 Oct: the ledger up to that day only, so no sales yet and the 1 Oct receipt's cost, not the 16 Oct one.
  const then = (await dead(30, "2026-10-13")).rows.find(
    (row: any) => row.productId === products.standard.id,
  );
  expect(then).toMatchObject({
    onHand: 100_000,
    lastSale: null,
    unitCost: COST,
    value: 100 * COST,
  });
});

test("a day of refunds only reads as negative revenue, with margin and shares still worked out", async () => {
  const event = refundEvent(w.world, w.sales[1]!, [{ line: 0, before: 0, after: 1_000 }]);
  event.refund.deviceTime = "2026-10-16T09:00:00.000Z";
  const posted = await postRefund(event, w.world.session.proof);
  expect(posted.body.accepted, JSON.stringify(posted.body)).toBeTruthy();
  const day = "from=2026-10-16&to=2026-10-16";
  const products = await read(`/reports/products?${day}`);
  expect(products.rows[0]).toMatchObject({
    revenue: -figure(1, NET),
    cost: -COST,
    marginBps: expect.any(Number),
  });
  expect(products.total.marginBps).toBe(
    Math.round(((COST - figure(1, NET)) * 10_000) / -figure(1, NET)),
  );
  const branches = await read(`/reports/branches?${day}`);
  expect(branches.rows[0]).toMatchObject({ netSales: -figure(1, 0), shareBps: 10_000 });
  // The day after compares with a negative day: the change is against its size.
  const dashboard = await read("/reports/dashboard?day=2026-10-17");
  expect(dashboard.kpis.netSales).toMatchObject({
    value: 0,
    yesterday: -figure(1, 0),
    changeBps: 10_000,
  });
});

test("a day selling at a new cost while refunding at an old one rolls up into one row per product", async () => {
  await runGolden(
    w.world,
    tradingDay.find((sale) => sale.name === "manual card")!,
    new Date("2026-10-16T11:00:00.000Z"),
  );
  const path = `/reports/products?from=2026-10-16&to=2026-10-16&branchId=${ids.branch}`;
  const live = await read(path);
  // Sold at the 16 Oct receipt's cost; the refund reverses the 50000 its sale was booked at.
  expect(live.rows[0]).toMatchObject({
    quantity: 1_000,
    refundQuantity: 1_000,
    cost: 90_000 - COST,
    costed: "all",
  });
  await rollStoreDays(
    w.world.db,
    { ...w.world.command, actorId: undefined },
    {
      storeId: ids.store,
      through: "2026-10-16",
    },
  );
  expect(await read(path)).toEqual(live);
});

test("an archived product is not dead stock", async () => {
  const on = "/reports/stock/dead?days=30&on=2026-12-20";
  expect((await read(on)).rows.map((row: any) => row.productId)).toContain(products.standard.id);
  await w.world.db
    .update(product)
    .set({ archivedAt: new Date() })
    .where(eq(product.id, products.standard.id));
  expect((await read(on)).rows.map((row: any) => row.productId)).not.toContain(
    products.standard.id,
  );
});

test("refunding a sale that was never costed leaves the product's margin flagged incomplete", async () => {
  const event = refundEvent(w.world, { ...w.sales[copied.index]!, id: w.copy }, [
    { line: 0, before: 0, after: 1_000 },
  ]);
  event.refund.deviceTime = "2026-10-16T13:00:00.000Z";
  const posted = await postRefund(event, w.world.session.proof);
  expect(posted.body.accepted, JSON.stringify(posted.body)).toBeTruthy();
  const body = await read(`/reports/products?from=2026-10-16&to=2026-10-16&branchId=${ids.branch}`);
  expect(body.rows[0]).toMatchObject({
    refundQuantity: 2_000,
    cost: 90_000 - COST,
    costed: "some",
  });
  expect(body.total.uncosted).toBe(1);
});
