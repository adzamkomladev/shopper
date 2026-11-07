// Day 35: once picking changed an order, the shopper's order page totals are what they pay now, not what they ordered.
// 2 oil at 30.00 and 1.5 kg rice at 18.50 (GHS 87.75); one oil short, replaced by palm oil at 25.00: GHS 82.75.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { finishStoreOrder, readOrderView, recordPick } from "@shopper/core/orders";
import { fulfilWorld } from "../../support/orders/fulfil";
import { pickHelpers } from "../../support/orders/pick";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

test("the order page totals follow the pick: the after-pick gross, its tax parts adding up", async () => {
  const { order, oil, rice } = await pickHelpers(f).accepted();
  const view = () => readOrderView(f.world.db, f.world.a.orgId, order.id, order.key);
  const before = (await view())!.totals;
  expect(before.gross).toBe(877_500);
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_500 });
  // Nothing changes for the shopper while the pick is being recorded.
  expect((await view())!.totals).toEqual(before);
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);

  const after = (await view())!;
  expect(after.adjustment).toMatchObject({ afterGross: 827_500 });
  expect(after.totals.gross).toBe(827_500);
  const parts = after.totals;
  expect(parts.base + parts.vat + parts.nhil + parts.getfund + parts.covid).toBeLessThanOrEqual(
    827_500,
  );
  expect(parts.base).toBeLessThan(before.base);
});
