import { env } from "cloudflare:test";
import { test } from "vitest";
import { v7 } from "uuid";
import { cloudflareBlobs } from "@shopper/adapters-cf";
import { uploadConformance } from "@shopper/conformance";

uploadConformance("workerd S3 upload adapter", test, async (now) => {
  const bindings = env as { BLOBS: R2Bucket };
  const { blobs } = await cloudflareBlobs(bindings.BLOBS, {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: {
      endpoint: "http://127.0.0.1:9200",
      bucket: "shopper-imports-dev",
      accessKeyId: "shopper_dev_access",
      secretAccessKey: "shopper_dev_secret_at_least_32_chars",
      region: "us-east-1",
      now,
    },
  });
  return { blobs, orgId: v7(), otherOrgId: v7() };
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
