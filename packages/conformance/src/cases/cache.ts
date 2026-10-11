import assert from "node:assert/strict";
import type { ConformanceTest, Fixture } from "../types";

export function cacheCases(name: string, test: ConformanceTest, fixture: Fixture) {
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
}
