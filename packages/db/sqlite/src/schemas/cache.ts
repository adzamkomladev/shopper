import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import type { Json } from "@shopper/ports";

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
