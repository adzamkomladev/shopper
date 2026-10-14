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
  options: BlobUrlOptions & { objectStorage?: ObjectStorageOptions },
) {
  const access = await blobUrlAccess(options);
  const objects = options.objectStorage ? objectStorage(options.objectStorage) : undefined;
  const blobs: Blobs = {
    async put(orgId, key, value) {
      if (key.startsWith("imports/") && objects) return objects.put(orgId, key, value);
      await binding.put(scopedKey(orgId, key).replaceAll("/", ":"), new Uint8Array(value));
    },
    async get(orgId, key, maxBytes) {
      if (key.startsWith("imports/") && objects) return objects.get(orgId, key, maxBytes);
      const value = await binding.get(scopedKey(orgId, key).replaceAll("/", ":"));
      return value ? readBlobBody(value.body, value.size, maxBytes) : null;
    },
    async delete(orgId, key) {
      if (key.startsWith("imports/") && objects) return objects.delete(orgId, key);
      await binding.delete(scopedKey(orgId, key).replaceAll("/", ":"));
    },
    async createUpload(orgId, key, input) {
      if (!key.startsWith("imports/")) throw new Error("Direct uploads require an imports key");
      if (!objects) throw new BlobUploadUnavailable();
      return objects.createUpload(orgId, key, input);
    },
    signedUrl: access.sign,
  };
  return { blobs, readSigned: access.read };
}
