// Day 35: online orders count in every report. Two orders of 2 oil at 30.00 and 1.5 kg rice at 18.50 (GHS 87.75 each),
// paid by card. A is picked short (one oil, replaced by palm oil at 25.00; 1 kg rice), B is cancelled by the store and
// refunded in full. The reports read the same before and after the day is rolled up.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { cancelStoreOrder, finishStoreOrder, recordPick } from "@shopper/core/orders";
import { dashboard, productReport, rollStoreDays, salesReport } from "@shopper/core/reports";
import { fulfilWorld } from "../../support/orders/fulfil";
import { pickHelpers } from "../../support/orders/pick";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
const today = new Date().toISOString().slice(0, 10);
const range = { from: today, to: today };

beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
  const { accepted } = pickHelpers(f);
  const a = await accepted();
  await recordPick(f.world.db, f.ctx, {
    id: a.order.id,
    lineId: a.oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, {
    id: a.order.id,
    lineId: a.rice.id,
    pickedThousandths: 1_000,
  });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, a.order.id);
  const b = await accepted();
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, b.order.id);
}, 180_000);
afterAll(async () => {
  await f?.close();
});

const orgId = () => f.world.a.orgId;
const sales = (by: string) => salesReport(f.world.db, orgId(), { ...range, by });

/** Every report the owner reads, as the figures this suite checks. */
async function figures() {
  const day = await sales("day");
  const cashier = await sales("cashier");
  const tender = await sales("tender");
  const products = await productReport(f.world.db, orgId(), range);
  const board = await dashboard(f.world.db, orgId(), { day: today }, undefined, today);
  const product = (id: string) => products.rows.find((row) => row.productId === id);
  return { day: day.total, cashier: cashier.rows, tender: tender.rows, product, board };
}

function expectOnline(read: Awaited<ReturnType<typeof figures>>) {
  // Sold: both orders and the substitute (175.50 + 25.00); given back: A's missing goods (39.25) and all of B (87.75).
  expect(read.day).toMatchObject({
    transactions: 2,
    gross: 2_005_000,
    refunds: 2,
    refundGross: 1_270_000,
    netSales: 735_000,
  });
  expect(read.cashier).toEqual([
    expect.objectContaining({
      key: "online",
      label: "Online shop",
      transactions: 2,
      netSales: 735_000,
    }),
  ]);
  // The card took both orders and paid back A's difference (14.25) and all of B.
  expect(read.tender).toEqual([
    expect.objectContaining({
      key: "card",
      transactions: 2,
      amount: 1_755_000,
      refunded: 1_020_000,
      net: 735_000,
    }),
  ]);
  expect(read.product(f.products.oil)).toMatchObject({ quantity: 4_000, refundQuantity: 3_000 });
  expect(read.product(f.products.rice)).toMatchObject({ quantity: 3_000, refundQuantity: 2_000 });
  expect(read.product(f.substitutes.palm)).toMatchObject({ quantity: 1_000, refundQuantity: 0 });
  expect(read.board.kpis.netSales.value).toBe(735_000);
  expect(read.board.kpis.transactions.value).toBe(2);
}

test("a paid, adjusted and refunded online order shows in sales, tenders, cashiers, products and the dashboard", async () => {
  expectOnline(await figures());
});

test("the rolled-up day reads the same, and a later paid order makes the day stale again", async () => {
  const storeId = f.shop.storeId;
  await rollStoreDays(f.world.db, f.ctx, { storeId, through: today });
  expectOnline(await figures());

  await f.paid();
  const [day] = await f.world.db
    .select()
    .from(schema.storeDay)
    .where(and(eq(schema.storeDay.storeId, storeId), eq(schema.storeDay.day, today)));
  expect(day!.rolledAt).toBeNull();
  expect((await sales("day")).total).toMatchObject({ transactions: 3, gross: 2_005_000 + 877_500 });
});
