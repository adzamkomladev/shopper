import { expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture } from "../../../support/till/push";
import { api, appVersion, deviceId, deviceToken, syncProtocol } from "../../../support/till/server";
import { v7 } from "uuid";

test("concurrent handshakes deliver the same two nonoverlapping receipt blocks", async () => {
  const replies = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const response = await api.request("/sync/handshake", {
        method: "POST",
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "X-Shopper-Device": deviceId,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: v7(),
          appVersion,
          protocol: syncProtocol,
          receiptLastUsed: 0,
        }),
      });
      expect(response.status).toBe(200);
      return response.json() as Promise<{ receipts: { blocks: { start: number; end: number }[] } }>;
    }),
  );
  expect(replies[0]?.receipts.blocks).toEqual([
    { start: 1, end: 1000 },
    { start: 1001, end: 2000 },
  ]);
  for (const reply of replies) expect(reply.receipts).toEqual(replies[0]?.receipts);
});

test("offline overflow is flagged and normal sequential numbers arrive after handshake", async () => {
  const fixture = await createPushFixture();
  try {
    const first = await fixture.recordSale();
    expect(first.event.v).toBe(5);
    expect(first.event.sale.receiptOverflow).toBe(true);
    const worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    await worker.trigger();
    const second = await fixture.recordSale();
    const third = await fixture.recordSale();
    expect(second.event.sale.receiptNumber).toMatch(/^BR\d+-T\d+-000001$/);
    expect(third.event.sale.receiptNumber).toMatch(/-000002$/);
    expect(second.event.sale.receiptOverflow).toBe(false);
  } finally {
    await fixture.close();
  }
});

test("a consumed block refills once and the response is redelivered after a lost reply", async () => {
  const handshake = async (receiptLastUsed: number) => {
    const response = await api.request("/sync/handshake", {
      method: "POST",
      headers: {
        authorization: `Bearer ${deviceToken}`,
        "X-Shopper-Device": deviceId,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: v7(),
        appVersion,
        protocol: syncProtocol,
        receiptLastUsed,
      }),
    });
    expect(response.status).toBe(200);
    return response.json() as Promise<{ receipts: { blocks: { start: number; end: number }[] } }>;
  };
  const first = await handshake(1000);
  expect(first.receipts.blocks).toEqual([
    { start: 1001, end: 2000 },
    { start: 2001, end: 3000 },
  ]);
  expect((await handshake(1000)).receipts).toEqual(first.receipts);
  expect((await handshake(0)).receipts).toEqual(first.receipts);
});

test("concurrent branch creates get distinct automatic codes", async () => {
  const { mutateManagement } = await import("@shopper/core/management");
  const { databases } = await import("../../../support/till/server");
  const { db, context } = databases();
  const { ids } = await import("../../../fixtures/sales/golden");
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      mutateManagement(db, context, {
        kind: "branch",
        action: "create",
        data: { name: `Receipt branch ${index}`, storeId: ids.store },
      }),
    ),
  );
  const codes = results.map((row) => (row.after as { code: string } | null)?.code);
  expect(new Set(codes).size).toBe(5);
  expect(codes.every((code) => /^BR[0-9]+$/.test(code ?? ""))).toBe(true);
});
