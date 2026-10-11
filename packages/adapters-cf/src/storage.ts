import { drizzle } from "drizzle-orm/d1";
import { createStorage } from "unstorage";
import r2Driver from "unstorage/drivers/cloudflare-r2-binding";
import { sqliteCache } from "@shopper/db-sqlite";
import { blobUrlAccess, storedBlobs, type BlobUrlOptions } from "@shopper/ports";

export function cloudflareCache(binding: D1Database, now = Date.now) {
  return sqliteCache(drizzle(binding), now);
}
export async function cloudflareBlobs(binding: R2Bucket, options: BlobUrlOptions) {
  const storage = createStorage({ driver: r2Driver({ binding }) });
  const access = await blobUrlAccess(options);
  return { blobs: storedBlobs(storage, access), readSigned: access.read };
}
