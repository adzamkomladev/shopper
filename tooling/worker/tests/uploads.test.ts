import { env } from "cloudflare:test";
import { afterAll, expect, test } from "vitest";
import { v7 } from "uuid";
import { cloudflareBlobs } from "@shopper/adapters-cf";
import { objectStorage } from "@shopper/ports";
import { receiptUploadConformance, uploadConformance } from "@shopper/conformance";
import { dropBucket, rustfs, testBucket } from "@shopper/tests/support/assets/rustfs";

// This file's own RustFS buckets, dropped after it, so parallel runs never share objects.
const importsBucket = testBucket();
const receiptsBucket = testBucket();
afterAll(async () => {
  await Promise.all(
    [importsBucket, receiptsBucket].map(async (bucket) => dropBucket(await bucket)),
  );
});

uploadConformance("workerd S3 grants (RustFS transport)", test, async (now) => {
  const bindings = env as { BLOBS: R2Bucket; IMPORTS: R2Bucket };
  const { blobs } = await cloudflareBlobs(bindings.BLOBS, {
    imports: bindings.IMPORTS,
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: { ...rustfs, bucket: await importsBucket, now },
  });
  // RustFS verifies the signed HTTP contract; native R2 storage is exercised below.
  const transport = objectStorage({ ...rustfs, bucket: await importsBucket, now });
  return {
    blobs: { ...blobs, get: transport.get, delete: transport.delete },
    orgId: v7(),
    otherOrgId: v7(),
  };
});

receiptUploadConformance("workerd S3 grants (RustFS transport)", test, async () => {
  const receipts = { ...rustfs, bucket: await receiptsBucket };
  const bindings = env as { BLOBS: R2Bucket; IMPORTS: R2Bucket; RECEIPTS: R2Bucket };
  const { blobs } = await cloudflareBlobs(bindings.BLOBS, {
    imports: bindings.IMPORTS,
    receipts: bindings.RECEIPTS,
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: { ...rustfs, bucket: await importsBucket },
    receiptsObjectStorage: receipts,
  });
  // RustFS verifies the signed HTTP contract; native R2 storage is exercised separately.
  const transport = objectStorage(receipts);
  return {
    blobs: { ...blobs, get: transport.get, delete: transport.delete },
    orgId: v7(),
    otherOrgId: v7(),
    bucket: receipts.bucket,
  };
});

test("R2 keeps existing unstorage object keys when bounded reads are enabled", async () => {
  const { BLOBS } = env as { BLOBS: R2Bucket };
  const orgId = v7();
  await BLOBS.put(`${orgId}:snapshots:existing.gz`, new Uint8Array([1, 2, 3]));
  const { blobs } = await cloudflareBlobs(BLOBS, {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
  });
  const bytes = await blobs.get(orgId, "snapshots/existing.gz", 3);
  if (!bytes || bytes[2] !== 3) throw new Error("Existing R2 snapshot became inaccessible");
  await blobs.delete(orgId, "snapshots/existing.gz");
});

test("imports use native R2 with slash keys, bounded reads and tenant isolation", async () => {
  const { BLOBS, IMPORTS } = env as { BLOBS: R2Bucket; IMPORTS: R2Bucket };
  const orgId = v7();
  const key = "imports/native.csv";
  const { blobs } = await cloudflareBlobs(BLOBS, {
    imports: IMPORTS,
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: {
      endpoint: "http://127.0.0.1:1",
      bucket: "unreachable",
      accessKeyId: "unused",
      secretAccessKey: "unused",
      region: "auto",
    },
  });
  await IMPORTS.put(`${orgId}/${key}`, new Uint8Array([1, 2, 3]));
  expect(await blobs.get(orgId, key, 3)).toEqual(new Uint8Array([1, 2, 3]));
  await expect(blobs.get(orgId, key, 2)).rejects.toThrow(RangeError);
  expect(await blobs.get(v7(), key)).toBeNull();
  await blobs.put(orgId, key, new Uint8Array([4]));
  expect(await (await IMPORTS.get(`${orgId}/${key}`))?.arrayBuffer()).toEqual(
    new Uint8Array([4]).buffer,
  );
  expect(await BLOBS.get(`${orgId}:imports:native.csv`)).toBeNull();
  expect(await BLOBS.get(`${orgId}/${key}`)).toBeNull();
  await blobs.delete(orgId, key);
  expect(await IMPORTS.get(`${orgId}/${key}`)).toBeNull();
});

test("internal imports work without signing credentials and never fall back to snapshots", async () => {
  const { BLOBS } = env as { BLOBS: R2Bucket };
  const options = { baseUrl: "https://shopper.test/blobs", secret: new Uint8Array(32) };
  const { blobs } = await cloudflareBlobs(BLOBS, { ...options, imports: BLOBS });
  const orgId = v7();
  await blobs.put(orgId, "imports/internal.csv", new Uint8Array([9]));
  expect(await blobs.get(orgId, "imports/internal.csv")).toEqual(new Uint8Array([9]));
  await expect(
    blobs.createUpload(orgId, "imports/internal.csv", {
      contentType: "text/csv",
      expiresInSeconds: 900,
    }),
  ).rejects.toMatchObject({ name: "BlobUploadUnavailable" });
  await blobs.delete(orgId, "imports/internal.csv");
  const missing = await cloudflareBlobs(BLOBS, options);
  await expect(
    missing.blobs.put(orgId, "imports/missing.csv", new Uint8Array([1])),
  ).rejects.toThrow(/binding/);
});
