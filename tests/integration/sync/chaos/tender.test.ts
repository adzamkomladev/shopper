import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { payment, sale, saleTender } from "@shopper/db-pg";
import { api } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { momoRegister } from "../../../support/till/host/momo";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { expectConverged, sell, waitForDrained } from "../../../support/till/host/chaos";

let register: Awaited<ReturnType<typeof momoRegister>> | undefined;
let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await fixture?.close();
  await upstream?.close();
  register = fixture = upstream = undefined;
});

type View = { draft: { revision: number; tenders: { reference?: string; status?: string }[] } };
type Draft = { type: string; view: View & { settlement: { balance: number } } };

test("a MoMo charge whose reply is lost, confirmed while the till is cut off, settles once on Sync now", async () => {
  register = await momoRegister();
  const host = await register.start();
  const added = (await host.request({
    type: "add",
    expectedRevision: 0,
    productId: register.productId,
  })) as Draft;
  const amount = added.view.settlement.balance;
  const reference = v7();
  const charge = { type: "payment.momo.start", phone: "0241234567", network: "mtn", amount };

  register.upstream.dropNextResponse("/payments/momo");
  expect(await host.request({ ...charge, id: reference, expectedRevision: 1 })).toMatchObject({
    type: "error",
  });
  const reserved = (await host.request({ type: "readDraft" })) as Draft;
  expect(reserved.view.draft.tenders).toMatchObject([{ reference, status: "pending" }]);

  // The whole network drops; the customer approves on their phone and Paystack tells the server.
  register.upstream.cut();
  expect((await register.momo.webhook(reference, "charge.success", amount / 100)).status).toBe(200);
  // The cashier presses pay again: the same reference is reused and nothing reaches Paystack twice.
  expect(
    await host.request({ ...charge, id: v7(), expectedRevision: reserved.view.draft.revision }),
  ).toMatchObject({ type: "error" });
  expect(register.momo.fake.requests.filter((request) => request.path === "/charge")).toHaveLength(
    1,
  );

  register.upstream.restore();
  await host.request({ type: "retry" }, 30_000);
  const confirmed = (await host.request({ type: "readDraft" })) as Draft;
  expect(confirmed.view.draft.tenders).toMatchObject([{ reference, status: "confirmed" }]);
  expect(confirmed.view.settlement.balance).toBe(0);
  expect(
    await host.request({ type: "sale.complete", expectedRevision: confirmed.view.draft.revision }),
  ).toMatchObject({ type: "result" });
  await waitForDrained(host, 30_000);
  expect(await register.queued()).toEqual([]);

  const db = register.momo.db;
  const [charged] = await db.select().from(payment).where(eq(payment.reference, reference));
  expect(charged).toMatchObject({ status: "confirmed" });
  const sales = await db.select().from(sale).where(eq(sale.orgId, register.momo.orgId));
  expect(sales).toHaveLength(1);
  const tenders = await db.select().from(saleTender).where(eq(saleTender.saleId, sales[0]!.id));
  expect(tenders).toMatchObject([{ kind: "momo", paymentId: charged!.id, amount }]);
  expect(register.momo.fake.requests.filter((request) => request.path === "/charge")).toHaveLength(
    1,
  );
}, 120_000);

test("a card and cash split taken with the network down completes offline and uploads once", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const host = await fixture.start();
  upstream.cut();
  const added = (await host.request({
    type: "add",
    expectedRevision: 0,
    productId: fixture.config.references.products[0].id,
  })) as Draft;
  const total = added.view.settlement.balance;
  await host.request({
    type: "tender.add",
    expectedRevision: 1,
    kind: "card",
    amount: Math.floor(total / 2),
    approvalCode: "CHAOS1",
  });
  await host.request({ type: "tender.add", expectedRevision: 2, kind: "cash", amount: total });
  expect(await host.request({ type: "sale.complete", expectedRevision: 3 })).toMatchObject({
    type: "result",
  });
  expect(await fixture.queued()).toHaveLength(1);

  upstream.restore();
  await host.request({ type: "retry" }, 30_000);
  await waitForDrained(host);
  await expectConverged(fixture);
}, 120_000);

test("a sale whose upload reply is lost after the server accepted it keeps one sequence", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const host = await fixture.start();
  upstream.dropNextResponse("/sync/push");
  await sell(host, fixture.config.references.products[0].id);
  await waitForDrained(host, 30_000);
  const pushes = upstream.requests.filter((request) => request.path === "/sync/push");
  expect(pushes.length).toBeGreaterThanOrEqual(2);
  await expectConverged(fixture);
}, 120_000);
