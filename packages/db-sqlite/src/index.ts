import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { and, eq, gt } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { requestCache, type Json, type Cache } from "@shopper/ports";

export const cacheEntry = sqliteTable(
  "cache_entry",
  {
    orgId: text("org_id").notNull(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<Json>().notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.key] })],
);
export const cacheMigration = `CREATE TABLE IF NOT EXISTS cache_entry (
  org_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, key)
)`;
// Same queries on D1 and local SQLite; expiration is logical, never a timer per entry.
export function sqliteCache(
  db: Pick<BaseSQLiteDatabase<"async", unknown>, "select" | "insert" | "delete">,
  now = Date.now,
): Cache {
  return requestCache({
    async get(orgId, key) {
      const [row] = await db
        .select()
        .from(cacheEntry)
        .where(
          and(
            eq(cacheEntry.orgId, orgId),
            eq(cacheEntry.key, key),
            gt(cacheEntry.expiresAt, now()),
          ),
        )
        .limit(1);
      return row?.value ?? null;
    },
    async put(orgId, key, value, ttlMs) {
      const expiresAt = now() + ttlMs;
      await db
        .insert(cacheEntry)
        .values({ orgId, key, value, expiresAt })
        .onConflictDoUpdate({
          target: [cacheEntry.orgId, cacheEntry.key],
          set: { value, expiresAt },
        });
    },
    async delete(orgId, key) {
      await db.delete(cacheEntry).where(and(eq(cacheEntry.orgId, orgId), eq(cacheEntry.key, key)));
    },
  });
}
