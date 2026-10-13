import { afterEach, expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";
let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
test("an empty host honors handshake Retry-After and caps connection backoff", async () => {
  let attempts = 0;
  fixture = await createPushFixture({
    alterHandshake: () => {
      attempts += 1;
      return Response.json(
        { error: "unavailable" },
        {
          status: attempts === 1 ? 429 : 503,
          headers: attempts === 1 ? { "retry-after": "120" } : undefined,
        },
      );
    },
  });
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  worker.start();
  await worker.trigger();
  await worker.trigger();
  expect(attempts).toBe(1);
  fixture.advanceTime(119_999);
  await worker.trigger();
  expect(attempts).toBe(1);
  fixture.advanceTime(1);
  await worker.trigger();
  expect(attempts).toBe(2);
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    fixture.advanceTime(delay - 1);
    await worker.trigger();
    const before = attempts;
    fixture.advanceTime(1);
    await worker.trigger();
    expect(attempts).toBe(before + 1);
  }
  expect(worker.getStatus()).toMatchObject({ server: "offline", pendingCount: 0 });
});

test("an HTTP-date Retry-After retains pending sales until the server deadline", async () => {
  let attempts = 0;
  fixture = await createPushFixture({
    alterResponse: (_response, call) => {
      attempts += 1;
      if (call > 1) return _response;
      if (!fixture) throw new Error("Expected the initialized fixture clock");
      const deadline = Math.ceil(fixture.now / 1000) * 1000 + 120_000;
      return Response.json(
        { error: "busy" },
        { status: 429, headers: { "retry-after": new Date(deadline).toUTCString() } },
      );
    },
  });
  await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const [pending] = await fixture.queue();
  expect(pending?.nextAttemptAt).toBeGreaterThanOrEqual(fixture.now + 120_000);
  fixture.advanceTime(119_000);
  await worker.trigger();
  expect(attempts).toBe(1);
  fixture.advanceTime(2_000);
  await worker.trigger();
  expect(attempts).toBe(2);
  expect(await fixture.queue()).toHaveLength(0);
});
