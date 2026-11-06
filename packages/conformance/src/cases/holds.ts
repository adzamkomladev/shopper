import assert from "node:assert/strict";
import type { ConformanceTest, StockHoldFixture } from "../types";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The StockHold contract, for the Durable Object and its box twin: holds are released once their time is up and not
 * before, only at the watched branch, and the coordinator re-arms itself for the next expiry after each release.
 */
export function stockHoldConformance(
  name: string,
  test: ConformanceTest,
  fixture: () => Promise<StockHoldFixture>,
) {
  test(`${name}: StockHold releases a branch's holds once they expire, and only those`, async () => {
    const f = await fixture();
    try {
      const soon = await f.seed(f.branchId, 300);
      const later = await f.seed(f.branchId, 3_600_000);
      const elsewhere = await f.seed(f.otherBranchId, 300);
      await f.holds.watch(f.orgId, f.branchId, soon.expiresAt);
      await pause(400);
      await f.fire(f.branchId);
      assert.equal(await f.released(soon.orderId), "expired");
      assert.equal(await f.released(later.orderId), null);
      // Nobody watched the other branch, so its expired hold waits for its own coordinator.
      assert.equal(await f.released(elsewhere.orderId), null);
    } finally {
      await f.close();
    }
  });

  test(`${name}: an earlier watch moves the release forward and a later one never delays it`, async () => {
    const f = await fixture();
    try {
      const far = await f.seed(f.branchId, 3_600_000);
      await f.holds.watch(f.orgId, f.branchId, far.expiresAt);
      const near = await f.seed(f.branchId, 300);
      await f.holds.watch(f.orgId, f.branchId, near.expiresAt);
      await f.holds.watch(f.orgId, f.branchId, far.expiresAt);
      await pause(400);
      await f.fire(f.branchId);
      assert.equal(await f.released(near.orderId), "expired");
      assert.equal(await f.released(far.orderId), null);
    } finally {
      await f.close();
    }
  });

  test(`${name}: after a release the coordinator arms itself for the next expiry`, async () => {
    const f = await fixture();
    try {
      const first = await f.seed(f.branchId, 300);
      const second = await f.seed(f.branchId, 1_200);
      await f.holds.watch(f.orgId, f.branchId, first.expiresAt);
      await pause(400);
      await f.fire(f.branchId);
      assert.equal(await f.released(first.orderId), "expired");
      assert.equal(await f.released(second.orderId), null);
      await pause(1_000);
      await f.fire(f.branchId);
      assert.equal(await f.released(second.orderId), "expired");
    } finally {
      await f.close();
    }
  });
}
