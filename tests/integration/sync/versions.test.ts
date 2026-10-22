import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { sale } from "@shopper/db-pg";
import { createPushWorker } from "@shopper/sync";
import { acceptSale } from "@shopper/core/sales";
import { decodeSaleEvent, receiptDocument } from "@shopper/core/schemas";
import { goldenReceipt } from "../../support/hardware/receipt";
import { createPushFixture, type PushFixture } from "../../support/till/push";
import { databases, deviceId, recordSale } from "../../support/till/server";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("pre-tender protocols must re-bootstrap before uploading", async () => {
  fixture = await createPushFixture();
  await fixture.recordSale();
  for (const protocol of [1, 2]) {
    const worker = createPushWorker({
      ...fixture.workerOptions,
      config: { ...fixture.workerOptions.config, protocol },
    });
    await worker.trigger();
    expect(worker.getStatus()).toMatchObject({ server: "incompatible", pendingCount: 1 });
    await worker.stop();
  }
  expect(fixture.upstream.requests.some((request) => request.path === "/sync/push")).toBe(false);
});

test("future protocol clients are held in incompatible state by the current server", async () => {
  fixture = await createPushFixture();
  await fixture.recordSale();
  const worker = createPushWorker({
    ...fixture.workerOptions,
    config: {
      ...fixture.workerOptions.config,
      protocol: fixture.workerOptions.config.protocol + 1,
    },
  });
  fixture.worker = worker;
  await worker.trigger();
  expect(worker.getStatus()).toMatchObject({ server: "incompatible", pendingCount: 1 });
  expect(
    fixture.upstream.requests.find((request) => request.path === "/sync/handshake")?.status,
  ).toBe(409);
  expect(fixture.upstream.requests.some((request) => request.path === "/sync/push")).toBe(false);
  expect(await fixture.queue()).toHaveLength(1);
});

test("sale decoding rejects pre-tender events without upcasting", async () => {
  fixture = await createPushFixture();
  const recorded = await fixture.recordSale();
  for (const v of [1, 2]) expect(() => decodeSaleEvent({ ...recorded.event, v })).toThrow();
  expect(decodeSaleEvent(recorded.event)).toEqual(recorded.event);
});

test("A v4 sale event is upcast to v5 and accepted", async () => {
  const { event, proof } = await recordSale();
  const { customer: _customer, ...legacy } = event.sale as Record<string, unknown>;
  const v4 = { ...event, v: 4, sale: legacy };
  expect(decodeSaleEvent(v4)).toEqual({ ...event, v: 5, sale: { ...event.sale, customer: null } });

  const { db, context } = databases();
  const principal = {
    orgId: context.orgId,
    deviceId,
    branchId: event.sale.branchId,
    storeId: event.sale.storeId,
  };
  await acceptSale(db, principal, v4, proof);
  const [saved] = await db.select().from(sale).where(eq(sale.id, event.sale.id));
  expect(saved).toMatchObject({ eventVersion: 5, customerId: null });
});

test("A stored v2 receipt reads as v3 with no buyer", () => {
  const { v: _v, buyer: _buyer, ...rest } = goldenReceipt();
  const parsed = v.parse(receiptDocument, { v: 2, ...rest });
  expect(parsed).toMatchObject({ v: 3, kind: "sale", buyer: null });
  expect(parsed).toEqual(goldenReceipt());
});
