import { DatabaseSync, type SQLOutputValue, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import { sqliteCache, cacheMigration } from "@shopper/db-sqlite";
import { blobUrlAccess, storedBlobs, type BlobUrlOptions, type Sequencer } from "@shopper/ports";
import { nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";

// Local development fallback; the production Rivet host is scheduled for day 36.
export function boxCache(path: string, now = Date.now) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec(cacheMigration);
  const db = drizzle(async (query, params: SQLInputValue[], method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    statement.setReturnArrays(true);
    const rows = statement.all(...params) as unknown as SQLOutputValue[][];
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  });
  return { cache: sqliteCache(db, now), close: () => sqlite.close() };
}
export async function boxBlobs(path: string, options: BlobUrlOptions) {
  const storage = createStorage({ driver: fsDriver({ base: path }) });
  const access = await blobUrlAccess(options);
  return { blobs: storedBlobs(storage, access), readSigned: access.read };
}
export function boxSequencer(db: ShopperDatabase): Sequencer {
  return {
    next: (orgId, storeId, floor) =>
      nextStoreSequence(db, { orgId, appVersion: buildInfo.version }, storeId, floor),
  };
}
