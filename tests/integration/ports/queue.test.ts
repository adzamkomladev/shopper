import { v7 } from "uuid";
import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import type { Envelope, RetryPolicy } from "@shopper/ports";
import { launchQueue, memoryLaunch, rivetHost } from "@shopper/adapters-box";
import { boxQueue } from "@shopper/adapters-box/queue";
import { queueConformance } from "@shopper/conformance";
import { rivetEngine, rivetPool } from "../../support/rivet/engine";

const policy: RetryPolicy = { maxAttempts: 5, delayMs: 0, backoff: "constant" };
const message: Envelope = {
  id: v7(),
  orgId: v7(),
  v: 1,
  sequence: "1",
  type: "stock.low",
  payload: null,
};

queueConformance("box queue", test, async (handler) => {
  const queue = boxQueue(policy, handler);
  return { queue, settle: () => queue.idle() };
});

// On Rivet every message is a durable workflow: its retries are engine sleeps that survive a restart.
const rivet = rivetHost({ ...rivetEngine, pool: rivetPool() }).launch;
for (const [name, launch] of [
  ["launched queue (memory)", memoryLaunch],
  ["launched queue (Rivet)", rivet],
] as const) {
  queueConformance(name, test, async (handler) => {
    const queue = launchQueue(policy, handler, launch);
    return { queue, settle: () => queue.idle() };
  });

  test(`${name}: dead-letters after policy.maxAttempts`, async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempts: number[] = [];
    const queue = launchQueue(
      { ...policy, maxAttempts: 3 },
      async (d) => {
        attempts.push(d.attempts);
        await d.retry();
      },
      launch,
    );
    await queue.send({ ...message, id: v7() });
    await queue.idle();
    assert.deepEqual(attempts, [1, 2, 3]);
    assert.equal(
      log.mock.calls.filter(([entry]) => entry?.event === "queue.dead_letter").length,
      1,
    );
    log.mockRestore();
  });
}

test("box queue: The box queue dead-letters after policy.maxAttempts", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const attempts: number[] = [];
  const queue = boxQueue({ ...policy, maxAttempts: 3 }, async (d) => {
    attempts.push(d.attempts);
    await d.retry();
  });
  await queue.send(message);
  await queue.idle();
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.equal(log.mock.calls.filter(([entry]) => entry?.event === "queue.dead_letter").length, 1);
  log.mockRestore();
});
