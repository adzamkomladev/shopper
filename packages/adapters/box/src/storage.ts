import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SQLOutputValue, SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import { sqliteCache, cacheMigration } from "@shopper/db-sqlite";
import {
  blobUrlAccess,
  storedBlobs,
  objectStorage,
  type ObjectStorageOptions,
  type BlobUrlOptions,
} from "@shopper/ports";

// Local development fallback; the production Rivet host is scheduled for day 36.
export function boxCache(path: string, now = Date.now) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const require = createRequire(import.meta.url);
  const bun = !!process.versions.bun;
  const sqlite = bun
    ? new (require("bun:sqlite").Database)(path)
    : new (require("node:sqlite").DatabaseSync)(path);
  sqlite.exec(cacheMigration);
  const db = drizzle(async (query, params: SQLInputValue[], method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    if (!bun) statement.setReturnArrays(true);
    const rows = (
      bun ? statement.values(...params) : statement.all(...params)
    ) as SQLOutputValue[][];
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  });
  return { cache: sqliteCache(db, now), close: () => sqlite.close() };
}
export async function boxBlobs(
  path: string,
  options: BlobUrlOptions & {
    objectStorage?: ObjectStorageOptions;
    receiptsObjectStorage?: ObjectStorageOptions;
  },
) {
  const access = await blobUrlAccess(options);
  const storage = createStorage({ driver: fsDriver({ base: path }) });
  const local = storedBlobs(storage, access);
  const objects = options.objectStorage ? objectStorage(options.objectStorage) : undefined;
  const receipts = options.receiptsObjectStorage
    ? objectStorage(options.receiptsObjectStorage)
    : undefined;
  // Without a receipts store, receipts keys fall to `local`, whose grants fail with BlobUploadUnavailable.
  const selected = (key: string) =>
    (key.startsWith("receipts/") ? receipts : key.startsWith("imports/") ? objects : undefined) ??
    local;
  return {
    blobs: {
      put: (orgId: string, key: string, value: Uint8Array) => selected(key).put(orgId, key, value),
      get: (orgId: string, key: string, maxBytes?: number) =>
        selected(key).get(orgId, key, maxBytes),
      delete: (orgId: string, key: string) => selected(key).delete(orgId, key),
      createUpload: (
        orgId: string,
        key: string,
        input: import("@shopper/ports").BlobUploadOptions,
      ) => {
        if (!key.startsWith("imports/") && !key.startsWith("receipts/"))
          throw new Error("Direct uploads require an imports or receipts key");
        return selected(key).createUpload(orgId, key, input);
      },
      signedUrl: access.sign,
    },
    readSigned: access.read,
  };
}
