import { afterEach, expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";
let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
test("partial acknowledgment removes only explicitly accepted rows and retries omitted sales", async () => {
  fixture = await createPushFixture({
    alterResponse: async (response, call) => {
      if (call !== 1) return response;
      const body = (await response.json()) as {
        requestId: string;
        accepted: Array<{ localId: string; sequence: string }>;
        rejected: unknown[];
      };
      return Response.json({ ...body, accepted: body.accepted.slice(0, 1) });
    },
  });
  const first = await fixture.recordSale();
  const omitted = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const pending = await fixture.queue();
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ localId: omitted.event.sale.localId, attempts: 1 });
  expect((await fixture.sales()).map((row) => row.localId)).toContain(first.event.sale.localId);
  fixture.advanceTime(1000);
  await worker.trigger();
  expect(await fixture.queue()).toHaveLength(0);
  expect(await fixture.sales()).toHaveLength(2);
});

test.each(["9223372036854775808", "1".repeat(100)])(
  "an impossible persisted sequence %s leaves the sale queued",
  async (sequence) => {
    fixture = await createPushFixture({
      alterResponse: async (response) => {
        const body = (await response.json()) as {
          requestId: string;
          accepted: Array<{ localId: string; sequence: string }>;
          rejected: unknown[];
        };
        return Response.json({
          ...body,
          accepted: body.accepted.map((entry) => ({ ...entry, sequence })),
        });
      },
    });
    await fixture.recordSale();
    const worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    await worker.trigger();
    expect(await fixture.queue()).toHaveLength(1);
    expect((await fixture.sales())[0]?.storeSequence).toBeNull();
  },
);
