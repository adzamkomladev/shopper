import { v7 } from "uuid";
import assert from "node:assert/strict";
import { MAX_MESSAGE_BYTES, type Delivery, type Envelope } from "@shopper/ports";
import type { ConformanceTest, QueueFixture } from "../types";

const envelope = (tag: string): Envelope => ({
  id: v7(),
  orgId: v7(),
  v: 1,
  sequence: "1",
  type: "stock.low",
  payload: { tag },
});

export function queueConformance(name: string, test: ConformanceTest, fixture: QueueFixture) {
  test(`${name}: Queue send rejects an invalid envelope and one over 96 KB`, async () => {
    const { queue, settle } = await fixture(async (d) => d.ack());
    await assert.rejects(queue.send({ ...envelope("a"), v: "1" } as unknown as Envelope));
    await assert.rejects(
      queue.send({ ...envelope("b"), payload: "a".repeat(MAX_MESSAGE_BYTES) }),
      /96 KB/,
    );
    await queue.send(envelope("c"));
    await settle();
  });

  test(`${name}: A delivery comes back with attempts + 1 until it is acked`, async () => {
    const seen: Record<string, number[]> = { retry: [], silent: [], acked: [] };
    const { queue, settle } = await fixture(async (d: Delivery) => {
      const tag = (d.message.payload as { tag: string }).tag;
      const log = seen[tag]!;
      log.push(d.attempts);
      if (tag === "acked") return d.ack();
      if (d.attempts < 3) return tag === "retry" ? d.retry() : undefined;
      await d.ack();
    });
    for (const id of Object.keys(seen)) await queue.send(envelope(id));
    await settle();
    assert.deepEqual(seen.retry, [1, 2, 3]);
    assert.deepEqual(seen.silent, [1, 2, 3]);
    assert.deepEqual(seen.acked, [1]);
  });

  test(`${name}: A handler that throws is redelivered`, async () => {
    const attempts: number[] = [];
    const { queue, settle } = await fixture(async (d) => {
      attempts.push(d.attempts);
      if (d.attempts === 1) throw new Error("transient");
      await d.ack();
    });
    await queue.send(envelope("boom"));
    await settle();
    assert.deepEqual(attempts, [1, 2]);
  });

  test(`${name}: A retry then an ack still redelivers`, async () => {
    const attempts: number[] = [];
    const { queue, settle } = await fixture(async (d) => {
      attempts.push(d.attempts);
      if (d.attempts > 1) return d.ack();
      await d.retry();
      await d.ack();
    });
    await queue.send(envelope("both"));
    await settle();
    assert.deepEqual(attempts, [1, 2]);
  });
}
