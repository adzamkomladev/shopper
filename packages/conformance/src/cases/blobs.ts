import assert from "node:assert/strict";
import type { ConformanceTest, Fixture } from "../types";

export function blobsCases(name: string, test: ConformanceTest, fixture: Fixture) {
  test(`${name}: Blobs binary round-trip, signed access, expiry, and tenant isolation`, async () => {
    const f = await fixture();
    const binary = new Uint8Array([0, 255, 128, 10, 13]);
    await f.blobs.put(f.orgId, "receipts/a.pdf", binary);
    assert.deepEqual(
      Array.from((await f.blobs.get(f.orgId, "receipts/a.pdf"))!),
      Array.from(binary),
    );
    await assert.rejects(f.blobs.get(f.orgId, "receipts/a.pdf", 4), RangeError);
    assert.equal((await f.blobs.get(f.orgId, "receipts/a.pdf", 5))?.byteLength, 5);
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
}
