import { drizzle } from "drizzle-orm/d1";
import { sqliteCache } from "@shopper/db-sqlite";
import {
  BlobUploadUnavailable,
  blobUrlAccess,
  scopedKey,
  objectStorage,
  readBlobBody,
  type Blobs,
  type ObjectStorageOptions,
  type BlobUrlOptions,
} from "@shopper/ports";

export function cloudflareCache(binding: D1Database, now = Date.now) {
  return sqliteCache(drizzle(binding), now);
}
export async function cloudflareBlobs(
  binding: R2Bucket,
  options: BlobUrlOptions & {
    imports?: R2Bucket;
    receipts?: R2Bucket;
    objectStorage?: ObjectStorageOptions;
    receiptsObjectStorage?: ObjectStorageOptions;
  },
) {
  const access = await blobUrlAccess(options);
  const objects = options.objectStorage ? objectStorage(options.objectStorage) : undefined;
  const receiptObjects = options.receiptsObjectStorage
    ? objectStorage(options.receiptsObjectStorage)
    : undefined;
  const target = (orgId: string, key: string) => {
    const scoped = scopedKey(orgId, key);
    if (key.startsWith("imports/")) {
      if (!options.imports) throw new Error("Imports R2 binding is required");
      return { bucket: options.imports, key: scoped };
    }
    // Without a receipts binding these keys stay in BLOBS; direct upload grants are then unavailable.
    if (key.startsWith("receipts/") && options.receipts)
      return { bucket: options.receipts, key: scoped };
    return { bucket: binding, key: scoped.replaceAll("/", ":") };
  };
  const blobs: Blobs = {
    async put(orgId, key, value) {
      const object = target(orgId, key);
      await object.bucket.put(object.key, new Uint8Array(value));
    },
    async get(orgId, key, maxBytes) {
      const object = target(orgId, key);
      const value = await object.bucket.get(object.key);
      return value ? readBlobBody(value.body, value.size, maxBytes) : null;
    },
    async delete(orgId, key) {
      const object = target(orgId, key);
      await object.bucket.delete(object.key);
    },
    async createUpload(orgId, key, input) {
      const receipt = key.startsWith("receipts/");
      if (!receipt && !key.startsWith("imports/"))
        throw new Error("Direct uploads require an imports or receipts key");
      const store = receipt ? receiptObjects : objects;
      if (!store || !(receipt ? options.receipts : options.imports))
        throw new BlobUploadUnavailable();
      return store.createUpload(orgId, key, input);
    },
    signedUrl: access.sign,
  };
  return { blobs, readSigned: access.read };
}
