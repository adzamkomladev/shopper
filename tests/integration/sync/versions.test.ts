import { afterEach, describe, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { sale } from "@shopper/db-pg";
import { createPushWorker } from "@shopper/sync";
import { acceptSale } from "@shopper/core/sales";
import {
  decodeRefundEvent,
  decodeSaleEvent,
  decodeShiftClosedEvent,
  receiptDocument,
} from "@shopper/core/schemas";
import { refundEvent } from "../../support/sales/refunds";
import { shiftEvent } from "../../support/sales/shifts";
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

test("A v4 sale event is upcast to v6 and accepted; a v5 line counts as a registered shop's", async () => {
  const { event, proof } = await recordSale();
  const { customer: _customer, ...legacy } = event.sale as Record<string, unknown>;
  const v4 = { ...event, v: 4, sale: legacy };
  expect(decodeSaleEvent(v4)).toEqual({ ...event, v: 6, sale: { ...event.sale, customer: null } });
  const unflagged = event.sale.lines.map(
    ({ tax: { registered: _registered, ...tax }, ...line }) => ({
      ...line,
      tax,
    }),
  );
  const v5 = decodeSaleEvent({ ...event, v: 5, sale: { ...event.sale, lines: unflagged } });
  expect(v5.sale.lines.map((line) => line.tax.registered)).toEqual(unflagged.map(() => true));

  const { db, context } = databases();
  const principal = {
    orgId: context.orgId,
    deviceId,
    branchId: event.sale.branchId,
    storeId: event.sale.storeId,
  };
  await acceptSale(db, principal, v4, proof);
  const [saved] = await db.select().from(sale).where(eq(sale.id, event.sale.id));
  expect(saved).toMatchObject({ eventVersion: 6, customerId: null });
});

test("A stored v2 receipt reads as v4 with no buyer", () => {
  const { v: _v, buyer: _buyer, header, lines, ...rest } = goldenReceipt();
  const { vatInvoice: _vatInvoice, ...v2Header } = header;
  const v2Lines = lines.map(({ net: _net, ...line }) => line);
  const parsed = v.parse(receiptDocument, { v: 2, header: v2Header, lines: v2Lines, ...rest });
  expect(parsed).toMatchObject({ v: 4, kind: "sale", buyer: null, header: { vatInvoice: true } });
  expect(parsed.lines.map((line) => line.net)).toEqual(lines.map(() => null));
});

describe("refund and Z versions", () => {
  // Decoding needs only well-formed ids, not a seeded world.
  const id = "019a0000-0000-7000-8000-000000000001";
  const world = {
    session: { userId: id, id },
    config: { appVersion: "0.0.0-test", storeId: id },
    scope: { orgId: id, branchId: id, deviceId: id },
  } as any;

  test("a v1 refund reads as v3 that credited nothing to an account or points and has no credit-note number", async () => {
    fixture = await createPushFixture();
    const sold = (await fixture.recordSale()).event.sale;
    const old = refundEvent(world, sold, [{ line: 0, before: 0, after: 1_000 }]);
    expect(old.v).toBe(1);
    const read = decodeRefundEvent(old);
    expect(read).toEqual({
      ...old,
      v: 3,
      refund: {
        ...old.refund,
        creditNoteNumber: null,
        accountCredit: 0,
        pointsReturned: 0,
        pointsValue: 0,
      },
    });
    expect(decodeRefundEvent(read)).toEqual(read);
    expect(() => decodeRefundEvent({ ...old, v: 2 })).toThrow();
    expect(() => decodeRefundEvent({ ...read, v: 4 })).toThrow();
  });

  test("a v1 Z with no account lines reads as v2 with all-zero account lines; v2 needs them", async () => {
    const old = shiftEvent(world);
    expect(old.v).toBe(1);
    expect("account" in old.shift.report).toBe(false);
    const read = decodeShiftClosedEvent(old);
    const account = {
      sales: 0,
      payments: { cash: 0, momo: 0 },
      refunds: 0,
      points: 0,
      pointsValue: 0,
    };
    expect(read).toEqual({
      ...old,
      v: 2,
      shift: { ...old.shift, report: { ...old.shift.report, account } },
    });
    expect(decodeShiftClosedEvent(read)).toEqual(read);
    expect(() => decodeShiftClosedEvent({ ...old, v: 2 })).toThrow();
  });
});
