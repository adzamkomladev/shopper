import { test } from "vite-plus/test";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { uploadConformance } from "@shopper/conformance";

uploadConformance("RustFS box adapter", test, async (now) => {
  const { blobs } = await boxBlobs(".shopper/test-blobs", {
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

test("filesystem snapshots do not offer proxy uploads", async () => {
  const { blobs } = await boxBlobs(".shopper/test-blobs", {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
  });
  try {
    await blobs.createUpload(v7(), "imports/not-uploadable", {
      contentType: "text/csv",
      expiresInSeconds: 900,
    });
    throw new Error("Filesystem unexpectedly issued an upload grant");
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "BlobUploadUnavailable") throw error;
  }
});
