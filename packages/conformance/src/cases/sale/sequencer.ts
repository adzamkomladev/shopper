import assert from "node:assert/strict";
import type { ConformanceTest, SaleSequencerFixture } from "../../types";

export function saleSequencerCases(
  name: string,
  test: ConformanceTest,
  fixture: SaleSequencerFixture,
) {
  test(`${name}: accepted sale assignment is replay-safe across concurrency and reopen`, async () => {
    const f = await fixture();
    assert.equal(typeof f.sequencer.assignSale, "function", "Sequencer must assign accepted sales");
    const sale = await f.provisionPendingSale();
    const duplicates = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.sequencer.assignSale(sale.orgId, sale.storeId, sale.deviceId, sale.localId),
      ),
    );
    const sequence = duplicates[0];
    assert.ok(typeof sequence === "bigint" && sequence > 0n);
    assert.deepEqual(
      duplicates,
      Array.from({ length: 8 }, () => sequence),
    );
    const reopened = await f.reopen();
    assert.equal(
      await reopened.sequencer.assignSale(sale.orgId, sale.storeId, sale.deviceId, sale.localId),
      sequence,
    );
    assert.deepEqual(await sale.inspect(), { sequence, assignmentAudits: 1 });
  });

  test(`${name}: sale assignment enforces tenant, device and store scope`, async () => {
    const f = await fixture();
    assert.equal(typeof f.sequencer.assignSale, "function", "Sequencer must assign accepted sales");
    const sale = await f.provisionPendingSale();
    await assert.rejects(
      f.sequencer.assignSale(sale.otherOrgId, sale.storeId, sale.deviceId, sale.localId),
    );
    await assert.rejects(
      f.sequencer.assignSale(sale.orgId, sale.otherStoreId, sale.deviceId, sale.localId),
    );
    await assert.rejects(
      f.sequencer.assignSale(sale.orgId, sale.storeId, sale.otherDeviceId, sale.localId),
    );
    assert.deepEqual(await sale.inspect(), { sequence: null, assignmentAudits: 0 });
    const sequence = await f.sequencer.assignSale(
      sale.orgId,
      sale.storeId,
      sale.deviceId,
      sale.localId,
    );
    assert.ok(sequence > 0n);
    await assert.rejects(
      f.sequencer.assignSale(sale.orgId, sale.storeId, sale.deviceId, sale.missingLocalId),
    );
    assert.deepEqual(await sale.inspect(), { sequence, assignmentAudits: 1 });
  });

  test(`${name}: assignment and its audit roll back together`, async () => {
    const f = await fixture();
    assert.equal(typeof f.sequencer.assignSale, "function", "Sequencer must assign accepted sales");
    const sale = await f.provisionPendingSale();
    const sequenceBefore = await f.sequenceRecord();
    const removeFailure = await sale.failAssignmentAudit();
    try {
      await assert.rejects(
        f.sequencer.assignSale(sale.orgId, sale.storeId, sale.deviceId, sale.localId),
      );
    } finally {
      await removeFailure();
    }
    assert.deepEqual(await sale.inspect(), { sequence: null, assignmentAudits: 0 });
    assert.equal(await f.sequenceRecord(), sequenceBefore);
    const sequence = await f.sequencer.assignSale(
      sale.orgId,
      sale.storeId,
      sale.deviceId,
      sale.localId,
    );
    assert.deepEqual(await sale.inspect(), { sequence, assignmentAudits: 1 });
  });
}
