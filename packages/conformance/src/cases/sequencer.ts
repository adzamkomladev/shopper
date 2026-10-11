import assert from "node:assert/strict";
import { messageBody, MAX_MESSAGE_BYTES } from "@shopper/ports";
import type { ConformanceTest, Fixture } from "../types";

export function sequencerCases(name: string, test: ConformanceTest, fixture: Fixture) {
  test(`${name}: Sequencer concurrent writers, persistence, archive floor, and tenant isolation`, async () => {
    const f = await fixture();
    const first = await f.sequencer.next(f.orgId, f.storeId);
    const values = await Promise.all(
      Array.from({ length: 12 }, () => f.sequencer.next(f.orgId, f.storeId)),
    );
    assert.equal(new Set(values).size, values.length);
    assert.ok(values.every((value) => value > first));
    const last = values.reduce((max, value) => (value > max ? value : max));
    const reopened = await f.reopen();
    assert.ok((await reopened.sequencer.next(f.orgId, f.storeId)) > last);
    const floor = 9007199254740995n; // Beyond Number.MAX_SAFE_INTEGER.
    const restored = await f.sequencer.next(f.orgId, f.storeId, floor);
    assert.ok(restored > floor);
    assert.equal(await f.sequenceRecord(), restored);
    await assert.rejects(f.sequencer.next(f.otherOrgId, f.storeId));
    await assert.rejects(f.sequencer.next(f.orgId, f.storeId, -1n));
    const envelope = {
      id: f.storeId,
      orgId: f.orgId,
      v: 1,
      sequence: restored.toString(),
      type: "changed",
      payload: "a",
    };
    assert.ok(messageBody(envelope).includes(restored.toString()));
    assert.throws(
      () => messageBody({ ...envelope, payload: "a".repeat(MAX_MESSAGE_BYTES) }),
      /96 KB/,
    );
    assert.throws(
      () => messageBody({ ...envelope, payload: "€".repeat(MAX_MESSAGE_BYTES / 2) }),
      /96 KB/,
    );
  });
}
