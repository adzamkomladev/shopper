import assert from "node:assert/strict";
import { v7 } from "uuid";
import type { Envelope, Realtime } from "@shopper/ports";

export interface RealtimeFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  realtime: Realtime;
}
// Same cases on the StoreHub Durable Object and the box broadcaster.
export function realtimeConformance(
  name: string,
  test: (name: string, run: () => Promise<void>) => unknown,
  fixture: () => Promise<RealtimeFixture>,
) {
  test(`${name}: Realtime delivers to one store's devices only and stops on close`, async () => {
    const f = await fixture();
    const otherStore = v7();
    const till = await listen(f.realtime, f.orgId, f.storeId, v7(), "0");
    const sameStore = await listen(f.realtime, f.orgId, f.storeId, v7(), "0");
    const elsewhere = await listen(f.realtime, f.orgId, otherStore, v7(), "0");
    const otherOrg = await listen(f.realtime, f.otherOrgId, f.storeId, v7(), "0");
    const message = envelope(f.orgId, 1n);
    await f.realtime.publish(f.orgId, f.storeId, message);
    await till.received(1);
    await sameStore.received(1);
    await settle();
    assert.deepEqual(till.messages, [message]);
    assert.equal(elsewhere.messages.length + otherOrg.messages.length, 0);
    await till.close();
    await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, 2n));
    await sameStore.received(2);
    await settle();
    assert.equal(till.messages.length, 1);
    await Promise.all([sameStore.close(), elsewhere.close(), otherOrg.close()]);
  });
  test(`${name}: Realtime replays after the cursor and keeps one socket per device`, async () => {
    const f = await fixture();
    for (const sequence of [1n, 2n, 3n])
      await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, sequence));
    const device = v7();
    const first = await listen(f.realtime, f.orgId, f.storeId, device, "1");
    await first.received(2);
    assert.deepEqual(
      first.messages.map((message) => message.sequence),
      ["2", "3"],
    );
    const replacement = await listen(f.realtime, f.orgId, f.storeId, device, "3");
    await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, 4n));
    await replacement.received(1);
    await settle();
    assert.equal(first.messages.length, 2);
    await replacement.close();
  });
  test(`${name}: Realtime orders replay numerically past 2^53`, async () => {
    const f = await fixture();
    for (const sequence of [9n, 10n, 9007199254740993n])
      await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, sequence));
    const till = await listen(f.realtime, f.orgId, f.storeId, v7(), "9");
    await till.received(2);
    assert.deepEqual(
      till.messages.map((message) => message.sequence),
      ["10", "9007199254740993"],
    );
    await till.close();
  });
  test(`${name}: Realtime replays by sequence and finishes each delivery before the next`, async () => {
    const f = await fixture();
    for (const sequence of [2n, 1n])
      await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, sequence));
    const finished: string[] = [];
    const subscription = await f.realtime.subscribe(f.orgId, f.storeId, v7(), "0", async (m) => {
      if (m.sequence === "1") await new Promise((resolve) => setTimeout(resolve, 100));
      finished.push(m.sequence);
    });
    for (let waited = 0; finished.length < 2 && waited < 5000; waited += 10)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(finished, ["1", "2"]);
    await subscription.close();
  });
  test(`${name}: Realtime drops a device whose handler fails and keeps serving the rest`, async () => {
    const f = await fixture();
    const healthy = await listen(f.realtime, f.orgId, f.storeId, v7(), "0");
    let failingCalls = 0;
    const failing = await f.realtime.subscribe(f.orgId, f.storeId, v7(), "0", async () => {
      failingCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      throw new Error("till crashed");
    });
    await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, 1n));
    await f.realtime.publish(f.orgId, f.storeId, envelope(f.orgId, 2n));
    await healthy.received(2);
    await settle();
    // Nothing queued behind the failure reaches the dropped device, so its cursor never skips it.
    assert.equal(failingCalls, 1);
    await Promise.all([healthy.close(), failing.close()]);
  });
  test(`${name}: Realtime rejects malformed or cross-tenant messages`, async () => {
    const f = await fixture();
    for (const [device, cursor] of [
      ["", "0"],
      ["till-1", "0"],
      [v7(), ""],
      [v7(), "0x10"],
      [v7(), "1".repeat(20)],
    ])
      await assert.rejects(
        f.realtime.subscribe(f.orgId, f.storeId, device!, cursor!, async () => {}),
      );
    await assert.rejects(
      f.realtime.publish(f.orgId, f.storeId, { ...envelope(f.orgId, 1n), id: "not-a-uuid" }),
    );
    await assert.rejects(f.realtime.publish(f.orgId, f.storeId, envelope(f.otherOrgId, 1n)));
  });
}

function envelope(orgId: string, sequence: bigint): Envelope {
  return {
    id: v7(),
    orgId,
    v: 1,
    sequence: sequence.toString(),
    type: "price.changed",
    payload: {},
  };
}
async function listen(
  realtime: Realtime,
  orgId: string,
  storeId: string,
  deviceId: string,
  cursor: string,
) {
  const messages: Envelope[] = [];
  const subscription = await realtime.subscribe(orgId, storeId, deviceId, cursor, async (m) => {
    messages.push(m);
  });
  return {
    messages,
    close: () => subscription.close(),
    async received(count: number) {
      for (let waited = 0; messages.length < count; waited += 10) {
        if (waited > 5000) throw new Error(`Expected ${count} messages, got ${messages.length}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
