import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/core";
import { add, money, sub } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import {
  appVersion,
  api,
  databases,
  deviceId,
  recordSale,
  syncProtocol,
} from "../../support/till/server";
import { push, pushEvents, syncHeaders } from "../../support/till/requests";

const addFuturePrice = defineCommand({
  name: "sync.test.future-price",
  run: (tx, ctx, input: { productId: string; branchId: string }) =>
    tx
      .insert(schema.price)
      .values({
        orgId: ctx.orgId,
        productId: input.productId,
        branchId: input.branchId,
        amount: money(50_000),
        validFrom: new Date("2026-01-01T00:00:00Z"),
      })
      .returning(),
  audit: (_input, rows) => ({ priceId: rows[0]?.id }),
});

test("handshake and push accept the captured sale with one persistent store sequence", async () => {
  const handshakeRequestId = v7();
  const handshake = await api.request("/sync/handshake", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ requestId: handshakeRequestId, appVersion, protocol: syncProtocol }),
  });
  expect(handshake.status).toBe(200);
  expect(await handshake.json()).toMatchObject({
    requestId: handshakeRequestId,
    protocol: syncProtocol,
  });

  const captured = await recordSale();
  const requestId = v7();
  const capturedLine = captured.event.sale.lines[0];
  if (!capturedLine) throw new Error("Expected recorded sale line");
  await addFuturePrice(
    databases().db,
    { orgId: databases().context.orgId, appVersion },
    {
      productId: capturedLine.productId,
      branchId: captured.event.sale.branchId,
    },
  );
  const response = await push(
    api,
    captured.event,
    captured.proof,
    captured.sessionId,
    databases().context.orgId,
    requestId,
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    requestId,
    accepted: [{ localId: captured.event.sale.localId, sequence: "1" }],
    rejected: [],
  });
  const { db } = databases();
  const saved = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(saved).toHaveLength(1);
  const savedSale = saved[0];
  if (!savedSale) throw new Error("Expected accepted sale");
  const lines = await db
    .select()
    .from(schema.saleLine)
    .where(eq(schema.saleLine.saleId, savedSale.id));
  expect(savedSale).toMatchObject({ deviceId, storeSequence: 1n, payload: captured.event.sale });
  expect(lines).toHaveLength(1);
  expect(lines[0]?.payload).toEqual(captured.event.sale.lines[0]);
});

test("push rejects oversized batches and bodies before accepting any event", async () => {
  const captured = await recordSale();
  const proof = [{ sessionId: captured.sessionId, proof: captured.proof }];
  const oversizedBatch = await pushEvents(
    api,
    Array.from({ length: 201 }, () => captured.event),
    proof,
  );
  expect(oversizedBatch.status).toBe(400);
  const large = await recordSale({ lineCount: 3_000 });
  const largeBody = JSON.stringify({
    requestId: v7(),
    protocol: syncProtocol,
    events: [large.event],
    proofs: [{ sessionId: large.sessionId, proof: large.proof }],
  });
  expect(new TextEncoder().encode(largeBody).byteLength).toBeGreaterThan(1024 * 1024);
  const oversizedBody = await api.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(),
    body: largeBody,
  });
  expect(oversizedBody.status).toBe(413);
  const { db } = databases();
  const rejectedSales = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(rejectedSales).toHaveLength(0);
});

test("event versions outside the supported shape are rejected without persistence", async () => {
  const captured = await recordSale();
  for (const version of [0, 1, 2, 3, 8]) {
    const unsupported = { ...captured.event, v: version };
    const response = await pushEvents(
      api,
      [unsupported],
      [{ sessionId: captured.sessionId, proof: captured.proof }],
    );
    expect(response.status).toBe(200);
    expect((await response.json()).rejected).toMatchObject([
      { localId: captured.event.sale.localId, code: "UNSUPPORTED_EVENT_VERSION" },
    ]);
  }
  const { db } = databases();
  const rows = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(rows).toHaveLength(0);
});

test("an event without a correlatable local id is rejected as a malformed envelope", async () => {
  const captured = await recordSale();
  const malformed = await pushEvents(
    api,
    [{ v: 1, type: "sale.recorded", sale: { id: v7() } }],
    [{ sessionId: captured.sessionId, proof: captured.proof }],
  );
  expect(malformed.status).toBe(400);
  const { db } = databases();
  const rows = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(rows).toHaveLength(0);
});

test("server rejects tampered tax arithmetic and repriced captured snapshots", async () => {
  const captured = await recordSale();
  const arithmetic = structuredClone(captured.event);
  const arithmeticLine = arithmetic.sale.lines[0];
  if (!arithmeticLine) throw new Error("Expected sale line");
  arithmeticLine.tax.gross = add(arithmeticLine.tax.gross, money(1));
  arithmetic.sale.totals.gross = add(arithmetic.sale.totals.gross, money(1));
  const badArithmetic = await push(api, arithmetic, captured.proof, captured.sessionId);
  expect(badArithmetic.status).toBe(200);
  expect((await badArithmetic.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);

  const repriced = structuredClone(captured.event);
  const line = repriced.sale.lines[0];
  if (!line) throw new Error("Expected sale line");
  line.tax = snapshotLine({
    rule: line.tax.rule,
    on: line.tax.on,
    taxClass: line.tax.taxClass,
    priceMode: line.tax.priceMode,
    registered: line.tax.registered,
    unitPrice: sub(line.tax.unitPrice, money(1_000)),
    quantityThousandths: line.tax.quantityThousandths,
    discount: line.tax.discount,
  });
  const totals = { ...repriced.sale.totals };
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = money(0);
  for (const saleLine of repriced.sale.lines)
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], saleLine.tax[key]);
  repriced.sale.totals = totals;
  const badPrice = await push(api, repriced, captured.proof, captured.sessionId);
  expect(badPrice.status).toBe(200);
  expect((await badPrice.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);

  const { db } = databases();
  const saved = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(saved).toHaveLength(0);
});
