import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { bridgeMessage } from "@shopper/sync/bridge";
import { createHostFixture } from "../../../../support/till/host/fixture";
let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());
test("purchases lists and reads the immutable completed sale with its stored receipt", async () => {
  fixture = await createHostFixture({ freshSession: true });
  const host = await fixture.start();
  await host.request({
    type: "add",
    expectedRevision: 0,
    productId: fixture.config.references.products[0].id,
  });
  await host.request({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 12_000 });
  const completed = (await host.request({ type: "sale.complete", expectedRevision: 2 })) as {
    event: { sale: { id: string } };
  };
  const listed = await host.request({ type: "sales.list", expectedRevision: 0, page: 1 });
  expect(listed).toMatchObject({
    kind: "purchases",
    total: 1,
    purchases: [{ id: completed.event.sale.id, status: "completed", total: 12_000 }],
  });
  expect(v.safeParse(bridgeMessage, listed).success).toBe(true);
  const read = await host.request({
    type: "sales.read",
    expectedRevision: 0,
    saleId: completed.event.sale.id,
  });
  expect(read).toMatchObject({
    kind: "purchase",
    purchase: { receipt: { v: 3, saleId: completed.event.sale.id } },
  });
  expect(v.safeParse(bridgeMessage, read).success).toBe(true);
});
