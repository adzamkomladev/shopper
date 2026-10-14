export type { TillSqlite, TillDatabase } from "./types";

const initial = `
CREATE TABLE IF NOT EXISTS till_state (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 last_outbox_seq INTEGER NOT NULL DEFAULT 0, receipt_last_used INTEGER NOT NULL DEFAULT 0, receipt_overflow_counter INTEGER NOT NULL DEFAULT 0, branch_code TEXT, device_code TEXT, clock_offset_ms INTEGER NOT NULL DEFAULT 0, receipt_blocks TEXT NOT NULL DEFAULT '[]', pull_cursor TEXT NOT NULL DEFAULT '0', pull_initialized INTEGER NOT NULL DEFAULT 0, UNIQUE(org_id,device_id)
);
CREATE TABLE IF NOT EXISTS local_sale (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, local_id TEXT NOT NULL,
 payload TEXT NOT NULL, content_hash TEXT NOT NULL, store_sequence TEXT, occurred_at TEXT,
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

const lookup = `
ALTER TABLE till_state ADD COLUMN reference_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE product_lookup (
 org_id TEXT NOT NULL, product_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(org_id,product_id)
);
CREATE INDEX product_lookup_sku ON product_lookup(org_id,sku);
CREATE TABLE product_barcode (
 org_id TEXT NOT NULL, code TEXT NOT NULL, product_id TEXT NOT NULL, quantity_thousandths INTEGER NOT NULL,
 PRIMARY KEY(org_id,code)
);
CREATE INDEX product_barcode_product ON product_barcode(org_id,product_id);
CREATE VIRTUAL TABLE product_search USING fts5(name, tokenize='unicode61');
INSERT INTO product_lookup(org_id,product_id,sku,name)
 SELECT org_id, id, COALESCE(json_extract(payload,'$.sku'),''), json_extract(payload,'$.name') FROM reference
 WHERE entity='product' AND json_extract(payload,'$.name') IS NOT NULL AND json_extract(payload,'$.archivedAt') IS NULL;
INSERT INTO product_search(rowid,name) SELECT rowid, name FROM product_lookup;
INSERT OR REPLACE INTO product_barcode(org_id,code,product_id,quantity_thousandths)
 SELECT r.org_id, json_extract(b.value,'$.code'), r.id, json_extract(b.value,'$.quantityThousandths')
 FROM reference r, json_each(r.payload,'$.barcodes') b
 WHERE r.entity='product' AND json_extract(r.payload,'$.archivedAt') IS NULL;`;

const drafts = `
CREATE TABLE sale_draft (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, branch_id TEXT NOT NULL,
 cashier_id TEXT NOT NULL, revision INTEGER NOT NULL, totals TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(org_id,device_id,branch_id,cashier_id), UNIQUE(org_id,id)
);
CREATE TABLE sale_draft_line (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, draft_id TEXT NOT NULL, position INTEGER NOT NULL,
 product_id TEXT NOT NULL, quantity_thousandths INTEGER NOT NULL, label TEXT,
 UNIQUE(draft_id,position), FOREIGN KEY(org_id,draft_id) REFERENCES sale_draft(org_id,id)
);`;

/** Ordered till SQLite steps driven by PRAGMA user_version. Shipped steps are never edited; append new ones. */
export const tillMigrations: string[] = [initial, lookup, drafts];
