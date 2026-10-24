import assert from "node:assert/strict";
import type { LaneFixture } from "../types";

/**
 * The FiscalLane contract, for the Durable Object and its box twin: one ordered lane per store, a failing head retried
 * before anything behind it, dead-lettered after its tenth failure, duplicates submitted once, and stores independent.
 */
export function laneConformance(
  name: string,
  test: (name: string, run: () => Promise<void>) => unknown,
  fixture: () => Promise<LaneFixture>,
) {
  test(`${name}: Submissions for one store arrive at the mock SDC in receipt order, even after retries`, async () => {
    const f = await fixture();
    try {
      const docs = await f.docs(f.storeId, "R", 5);
      await f.lane.enqueue(f.orgId, f.storeId, docs[0]!);
      await f.drain(f.storeId);
      // The second document fails twice; nothing behind it may overtake it.
      await f.sdc.failNext(2);
      for (const doc of docs.slice(1)) await f.lane.enqueue(f.orgId, f.storeId, doc);
      await f.drain(f.storeId);
      assert.deepEqual(await f.sdc.arrivals(), ["R-1", "R-2", "R-2", "R-2", "R-3", "R-4", "R-5"]);
      for (const doc of docs) assert.equal(await f.status(doc), "accepted");
    } finally {
      await f.close();
    }
  });

  test(`${name}: the tenth failure dead-letters the head and the lane moves on`, async () => {
    const f = await fixture();
    try {
      const [dead, next] = await f.docs(f.storeId, "D", 2);
      await f.sdc.failNext(10);
      await f.lane.enqueue(f.orgId, f.storeId, dead!);
      await f.lane.enqueue(f.orgId, f.storeId, next!);
      await f.drain(f.storeId);
      assert.deepEqual(await f.sdc.arrivals(), [...Array(10).fill("D-1"), "D-2"]);
      assert.equal(await f.status(dead!), "dead");
      assert.equal(await f.status(next!), "accepted");
    } finally {
      await f.close();
    }
  });

  test(`${name}: a document enqueued twice, or again once settled, is submitted once`, async () => {
    const f = await fixture();
    try {
      const [doc] = await f.docs(f.storeId, "U", 1);
      await f.lane.enqueue(f.orgId, f.storeId, doc!);
      await f.lane.enqueue(f.orgId, f.storeId, doc!);
      await f.drain(f.storeId);
      await f.lane.enqueue(f.orgId, f.storeId, doc!);
      await f.drain(f.storeId);
      assert.deepEqual(await f.sdc.arrivals(), ["U-1"]);
      assert.equal(await f.status(doc!), "accepted");
    } finally {
      await f.close();
    }
  });

  test(`${name}: a store waiting on a failed head does not hold up another store`, async () => {
    const f = await fixture();
    try {
      const [held] = await f.docs(f.storeId, "A", 1);
      const [free] = await f.docs(f.otherStoreId, "B", 1);
      await f.sdc.down();
      await f.lane.enqueue(f.orgId, f.storeId, held!);
      await f.drain(f.storeId, 1);
      await f.sdc.up();
      await f.lane.enqueue(f.orgId, f.otherStoreId, free!);
      await f.drain(f.otherStoreId);
      assert.equal(await f.status(free!), "accepted");
      assert.equal(await f.status(held!), "pending");
      await f.drain(f.storeId);
      assert.equal(await f.status(held!), "accepted");
    } finally {
      await f.close();
    }
  });

  test(`${name}: waiting documents survive a restart and keep their order`, async () => {
    const f = await fixture();
    try {
      const docs = await f.docs(f.storeId, "S", 2);
      await f.sdc.down();
      for (const doc of docs) await f.lane.enqueue(f.orgId, f.storeId, doc);
      await f.drain(f.storeId, 1);
      await f.reopen();
      await f.sdc.up();
      await f.drain(f.storeId);
      assert.deepEqual(await f.sdc.arrivals(), ["S-1", "S-2"]);
      for (const doc of docs) assert.equal(await f.status(doc), "accepted");
    } finally {
      await f.close();
    }
  });
}
