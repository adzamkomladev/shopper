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
  memoryWorkflow,
  storedBlobs,
  type BlobUrlOptions,
  type Sequencer,
  type Workflow,
} from "@shopper/ports";
import { nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";

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
export function boxWorkflow(instanceId: string): Workflow {
  return memoryWorkflow(instanceId);
}
export { boxDatabase } from "./database";
