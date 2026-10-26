import { test } from "vite-plus/test";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { receiptUploadConformance, uploadConformance } from "@shopper/conformance";
import { rustfs } from "../../../tooling/storage/buckets";
import { fileBucket } from "../../support/assets/buckets";

const importsBucket = fileBucket();
const receiptsBucket = fileBucket();

uploadConformance("RustFS box adapter", test, async (now) => {
  const { blobs } = await boxBlobs(".shopper/test-blobs", {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: { ...rustfs, bucket: await importsBucket, now },
  });
  return { blobs, orgId: v7(), otherOrgId: v7() };
});

receiptUploadConformance("RustFS box adapter", test, async () => {
  const { blobs } = await boxBlobs(".shopper/test-blobs", {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32),
    objectStorage: { ...rustfs, bucket: await importsBucket },
    receiptsObjectStorage: { ...rustfs, bucket: await receiptsBucket },
  });
  return { blobs, orgId: v7(), otherOrgId: v7(), bucket: await receiptsBucket };
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
