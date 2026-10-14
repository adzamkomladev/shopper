import assert from "node:assert/strict";
import type { Blobs } from "@shopper/ports";
import type { ConformanceTest } from "../types";

export function uploadConformance(
  name: string,
  test: ConformanceTest,
  fixture: (now?: () => number) => Promise<{ blobs: Blobs; orgId: string; otherOrgId: string }>,
) {
  test(`${name}: direct upload grants bind content type, key, method and lifetime`, async () => {
    const { blobs, orgId, otherOrgId } = await fixture();
    const key = `imports/${crypto.randomUUID()}`;
    const { blobs: expiredBlobs } = await fixture(() => Date.now() - 3_600_000);
    const expired = await expiredBlobs.createUpload(orgId, key, {
      contentType: "text/csv",
      expiresInSeconds: 900,
    });
    assert.equal(
      (
        await fetch(expired.url, {
          method: expired.method,
          headers: expired.headers,
          body: "expired",
        })
      ).status,
      403,
    );
    const grant = await blobs.createUpload(orgId, key, {
      contentType: "text/csv",
      expiresInSeconds: 900,
    });
    const url = new URL(grant.url);
    assert.equal(url.searchParams.get("X-Amz-Expires"), "900");
    assert.match(url.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-type/);
    assert.equal(grant.method, "PUT");
    const response = await fetch(grant.url, {
      method: grant.method,
      headers: grant.headers,
      body: "name\nRice",
    });
    assert.equal(response.status, 200);
    assert.equal(new TextDecoder().decode((await blobs.get(orgId, key, 9))!), "name\nRice");
    await assert.rejects(blobs.get(orgId, key, 8), RangeError);
    assert.equal(await blobs.get(otherOrgId, key), null);
    const wrongType = await fetch(grant.url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "bad",
    });
    assert.equal(wrongType.status, 403);
    const wrongMethod = await fetch(grant.url, { method: "GET", headers: grant.headers });
    assert.equal(wrongMethod.status, 403);
    url.pathname += "-forged";
    assert.equal(
      (await fetch(url, { method: "PUT", headers: grant.headers, body: "bad" })).status,
      403,
    );
    await assert.rejects(
      async () =>
        blobs.createUpload(orgId, "snapshots/overwrite", {
          contentType: "text/csv",
          expiresInSeconds: 900,
        }),
      /imports/,
    );
    await blobs.delete(orgId, key);
    assert.equal(await blobs.get(orgId, key), null);
  });
}
