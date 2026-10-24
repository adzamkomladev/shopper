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

test("the purchases list names the customer a sale was rung up to, and a walk-in has none", async () => {
  fixture = await createHostFixture({ freshSession: true });
  const host = await fixture.start();
  const productId = fixture.config.references.products[0].id;
  const created = (await host.request({
    type: "customer.create",
    name: "Ama Mensah",
    phone: "024 123 4567",
  })) as { customer: { id: string } };
  const sell = async (customerId: string | null) => {
    await host.request({ type: "add", expectedRevision: 0, productId });
    let revision = 1;
    if (customerId) {
      await host.request({ type: "customer.attach", expectedRevision: revision, customerId });
      revision += 1;
    }
    await host.request({
      type: "tender.add",
      expectedRevision: revision,
      kind: "cash",
      amount: 12_000,
    });
    const done = (await host.request({
      type: "sale.complete",
      expectedRevision: revision + 1,
    })) as { event: { sale: { id: string } } };
    return done.event.sale.id;
  };
  const named = await sell(created.customer.id);
  const walkIn = await sell(null);
  const listed = (await host.request({ type: "sales.list", expectedRevision: 0, page: 1 })) as {
    purchases: { id: string; customer?: { id: string; name: string } | null }[];
  };
  const by = (id: string) => listed.purchases.find((purchase) => purchase.id === id);
  expect(by(named)?.customer).toEqual({ id: created.customer.id, name: "Ama Mensah" });
  expect(by(walkIn)?.customer).toBeNull();
  expect(v.safeParse(bridgeMessage, listed).success).toBe(true);
});
