import { expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { provisionTillReference } from "@shopper/core/till";
import { createPushFixture } from "../../support/till/push";
import { context, deviceId } from "../../support/till/server";
import { references } from "../../support/till/sales";

test("receipt cursor bytes count toward the upload limit before sending", async () => {
  const fixture = await createPushFixture();
  try {
    const initial = await fixture.recordSale();
    const previousBody = JSON.stringify({
      requestId: initial.event.sale.id,
      protocol: fixture.workerOptions.config.protocol,
      events: [initial.event],
      proofs: [{ sessionId: initial.sessionId, proof: initial.proof }],
    });
    const name = initial.event.sale.lines[0]?.name;
    if (!name) throw new Error("Expected sale product name");
    const nearLimitName = "a".repeat(
      1_048_576 - 10 - Buffer.byteLength(previousBody) + name.length,
    );
    await provisionTillReference(
      fixture.database,
      { ...context, deviceId },
      {
        ...references,
        products: references.products.map((product) => ({ ...product, name: nearLimitName })),
      },
    );
    const oversized = await fixture.recordSale();
    await provisionTillReference(fixture.database, { ...context, deviceId }, references);
    await fixture.recordSale();
    const worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    await worker.trigger();
    const queue = await fixture.queue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.localId).toBe(oversized.event.sale.localId);
    expect(queue[0]?.blockedReason).toContain("EVENT_TOO_LARGE");
    const uploads = fixture.upstream.requests.filter((request) => request.path === "/sync/push");
    expect(uploads.every((request) => request.bytes <= 1_048_576 && request.status === 200)).toBe(
      true,
    );
    expect(
      uploads.every(
        (request) => (request.body as { receiptLastUsed: number }).receiptLastUsed === 0,
      ),
    ).toBe(true);
    expect(await fixture.sales()).toHaveLength(3);
  } finally {
    await fixture.close();
  }
});
