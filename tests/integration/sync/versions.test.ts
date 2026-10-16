import { afterEach, expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { decodeSaleEvent } from "@shopper/core/schemas";
import { createPushFixture, type PushFixture } from "../../support/till/push";

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
