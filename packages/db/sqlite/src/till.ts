import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export type TillSqlite = BaseSQLiteDatabase<"async", unknown>;
export interface TillDatabase {
  read<T>(fn: (db: TillSqlite) => Promise<T>): Promise<T>;
  transaction<T>(fn: (tx: TillSqlite) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const tillMigration = `
CREATE TABLE IF NOT EXISTS till_state (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 last_outbox_seq INTEGER NOT NULL DEFAULT 0, pull_cursor TEXT NOT NULL DEFAULT '0', UNIQUE(org_id,device_id)
);
CREATE TABLE IF NOT EXISTS local_sale (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, local_id TEXT NOT NULL,
 payload TEXT NOT NULL, content_hash TEXT NOT NULL, store_sequence TEXT,
 UNIQUE(device_id,local_id), UNIQUE(org_id,device_id,local_id), UNIQUE(org_id,id)
);
CREATE TABLE IF NOT EXISTS sale_line (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, sale_id TEXT NOT NULL, payload TEXT NOT NULL,
 FOREIGN KEY(org_id,sale_id) REFERENCES local_sale(org_id,id)
);
CREATE TABLE IF NOT EXISTS outbox (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, local_id TEXT NOT NULL,
 local_seq INTEGER NOT NULL, event TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0, blocked_reason TEXT,
 UNIQUE(org_id,device_id,local_seq), UNIQUE(org_id,device_id,local_id),
 FOREIGN KEY(org_id,device_id,local_id) REFERENCES local_sale(org_id,device_id,local_id)
);
CREATE TABLE IF NOT EXISTS reference (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, entity TEXT NOT NULL, payload TEXT NOT NULL,
 UNIQUE(org_id,entity,id)
);
CREATE TABLE IF NOT EXISTS till_audit (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, actor_id TEXT, role TEXT, device_id TEXT,
 branch_id TEXT, approver_id TEXT, reason TEXT, device_time INTEGER, entity TEXT, entity_id TEXT,
 before TEXT, after TEXT, app_version TEXT NOT NULL, command TEXT NOT NULL, payload TEXT NOT NULL,
 chain_seq INTEGER, prev_hash TEXT, hash TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(org_id,chain_seq)
 );
CREATE TABLE IF NOT EXISTS host_session (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 branch_id TEXT NOT NULL, user_id TEXT NOT NULL, role_name TEXT NOT NULL,
 issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, permissions TEXT NOT NULL, proof TEXT NOT NULL
);`;
