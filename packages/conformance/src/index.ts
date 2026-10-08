import assert from "node:assert/strict";
import {
  messageBody,
  MAX_MESSAGE_BYTES,
  type Blobs,
  type Cache,
  type Sequencer,
} from "@shopper/ports";
export interface AdapterFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  cache: Cache;
  blobs: Blobs;
  sequencer: Sequencer;
  advanceClock(ms: number): void;
  readSigned(url: string, blobs: Pick<Blobs, "get">): Promise<Uint8Array | null>;
  reopen(): Promise<{ cache: Cache; sequencer: Sequencer }>;
  sequenceRecord(): Promise<bigint>;
}
// Vitest 4 (workerd) and Vite+ both register these exact cases; no emulated ports.
export function portConformance(
  name: string,
  test: (name: string, run: () => Promise<void>) => unknown,
  fixture: () => Promise<AdapterFixture>,
) {
  test(`${name}: Cache TTL, tenant isolation, overwrite, delete, and request discipline`, async () => {
    const f = await fixture();
    assert.equal(await f.cache.request().get(f.orgId, "price"), null);
    const writer = f.cache.request();
    await writer.put(f.orgId, "price", { amount: 125000 }, 100);
    await assert.rejects(writer.get(f.orgId, "price"), /read-after-write/);
    assert.deepEqual(await f.cache.request().get(f.orgId, "price"), { amount: 125000 });
    assert.equal(await f.cache.request().get(f.otherOrgId, "price"), null);
    await f.cache.request().put(f.otherOrgId, "price", false, 500);
    const reopened = await f.reopen();
    assert.deepEqual(await reopened.cache.request().get(f.orgId, "price"), { amount: 125000 });
    f.advanceClock(100);
    assert.equal(await f.cache.request().get(f.orgId, "price"), null);
    assert.equal(await f.cache.request().get(f.otherOrgId, "price"), false);
    await f.cache.request().put(f.orgId, "price", "new", 100);
    await f.cache.request().delete(f.orgId, "price");
    assert.equal(await f.cache.request().get(f.orgId, "price"), null);
    await assert.rejects(f.cache.request().put(f.orgId, "price", 0, 0), /TTL/);
    await assert.rejects(f.cache.request().put(f.orgId, "../price", 0, 100), /key/);
  });
  test(`${name}: Blobs binary round-trip, signed access, expiry, and tenant isolation`, async () => {
    const f = await fixture();
    const binary = new Uint8Array([0, 255, 128, 10, 13]);
    await f.blobs.put(f.orgId, "receipts/a.pdf", binary);
    assert.deepEqual(
      Array.from((await f.blobs.get(f.orgId, "receipts/a.pdf"))!),
      Array.from(binary),
    );
    assert.equal(await f.blobs.get(f.otherOrgId, "receipts/a.pdf"), null);
    const url = await f.blobs.signedUrl(f.orgId, "receipts/a.pdf", 10);
    assert.deepEqual(Array.from((await f.readSigned(url, f.blobs))!), Array.from(binary));
    const forged = new URL(url);
    forged.searchParams.set("org", f.otherOrgId);
    await assert.rejects(f.readSigned(forged.toString(), f.blobs), /signature/);
    f.advanceClock(10_000);
    await assert.rejects(f.readSigned(url, f.blobs), /expired/);
    await f.blobs.put(f.orgId, "receipts/a.pdf", new Uint8Array());
    assert.equal((await f.blobs.get(f.orgId, "receipts/a.pdf"))?.byteLength, 0);
    await f.blobs.delete(f.orgId, "receipts/a.pdf");
    assert.equal(await f.blobs.get(f.orgId, "receipts/a.pdf"), null);
    await assert.rejects(f.blobs.put(f.orgId, "../escape", binary), /key/);
  });
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
