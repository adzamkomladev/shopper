// Day 35: an online order paid yesterday gets a substitute today, then is cancelled. Palm oil's receipt cost changed
// in between, so the substitute's refund must be costed on the day it went out (today), like its sale, and its cost nets
// to nothing; costing it on the day the order was paid would leave a cost for goods that all came back.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { cancelStoreOrder, finishStoreOrder, recordPick } from "@shopper/core/orders";
import { productReport } from "@shopper/core/reports";
import { fulfilWorld } from "../../support/orders/fulfil";
import { pickHelpers } from "../../support/orders/pick";
import { staffWorld } from "../../support/orders/staff";

const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
let f: Awaited<ReturnType<typeof fulfilWorld>>;

beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
  // A receipt is made by a person: the shop needs a signed-up user.
  await staffWorld(f.world.db, f.world.a.orgId, {});
}, 180_000);
afterAll(async () => {
  await f?.close();
});

test("a refunded substitute is costed on the day it went out, so its cost nets to nothing", async () => {
  const { order, oil, rice } = await pickHelpers(f).accepted();
  await f.receive(f.substitutes.palm, 150_000, new Date(Date.now() - 2 * DAY));
  const yesterday = new Date(Date.now() - DAY);
  await f.world.db
    .update(schema.onlineOrder)
    .set({ paidAt: yesterday })
    .where(eq(schema.onlineOrder.id, order.id));
  await f.world.db
    .update(schema.orderReportLine)
    .set({ occurredAt: yesterday })
    .where(
      and(eq(schema.orderReportLine.orderId, order.id), eq(schema.orderReportLine.source, "order")),
    );
  await f.receive(f.substitutes.palm, 200_000, new Date());
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_500 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id);

  const report = await productReport(f.world.db, f.world.a.orgId, { from: day(-2), to: day(0) });
  const palm = report.rows.find((row) => row.productId === f.substitutes.palm)!;
  expect(palm).toMatchObject({ cost: 0, costed: "all" });
});
