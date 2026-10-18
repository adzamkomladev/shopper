export type { TillSqlite, TillDatabase } from "./types";

const initial = `
CREATE TABLE IF NOT EXISTS till_state (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 last_outbox_seq INTEGER NOT NULL DEFAULT 0, receipt_last_used INTEGER NOT NULL DEFAULT 0, receipt_overflow_counter INTEGER NOT NULL DEFAULT 0, branch_code TEXT, device_code TEXT, clock_offset_ms INTEGER NOT NULL DEFAULT 0, receipt_blocks TEXT NOT NULL DEFAULT '[]', pull_cursor TEXT NOT NULL DEFAULT '0', pull_initialized INTEGER NOT NULL DEFAULT 0, reference_version INTEGER NOT NULL DEFAULT 1, UNIQUE(org_id,device_id)
);
CREATE TABLE IF NOT EXISTS local_sale (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, local_id TEXT NOT NULL,
 payload TEXT NOT NULL, content_hash TEXT NOT NULL, store_sequence TEXT, occurred_at TEXT, status TEXT NOT NULL DEFAULT 'completed', receipt TEXT,
 UNIQUE(device_id,local_id), UNIQUE(org_id,device_id,local_id), UNIQUE(org_id,id)
);
CREATE TABLE IF NOT EXISTS sale_line (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, sale_id TEXT NOT NULL, payload TEXT NOT NULL,
 FOREIGN KEY(org_id,sale_id) REFERENCES local_sale(org_id,id)
);
CREATE TABLE IF NOT EXISTS stock_movement (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, branch_id TEXT NOT NULL,
 product_id TEXT NOT NULL, sale_id TEXT NOT NULL, sale_line_id TEXT NOT NULL,
 quantity_thousandths INTEGER NOT NULL, reason TEXT NOT NULL CHECK(reason = 'sale'), occurred_at TEXT NOT NULL,
 UNIQUE(org_id,sale_line_id), FOREIGN KEY(org_id,sale_id) REFERENCES local_sale(org_id,id)
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
CREATE VIRTUAL TABLE product_search USING fts5(name, tokenize='unicode61');`;

const drafts = `
CREATE TABLE sale_draft (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, branch_id TEXT NOT NULL,
 cashier_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','held','voided')),
 name TEXT, revision INTEGER NOT NULL, totals TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, held_at TEXT, voided_at TEXT, void_reason TEXT,
 UNIQUE(org_id,id)
);
CREATE UNIQUE INDEX sale_draft_open ON sale_draft(org_id,device_id,branch_id,cashier_id) WHERE status = 'open';
CREATE TABLE sale_draft_line (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, draft_id TEXT NOT NULL, position INTEGER NOT NULL,
 product_id TEXT NOT NULL, quantity_thousandths INTEGER NOT NULL, label TEXT, discount INTEGER NOT NULL DEFAULT 0,
 UNIQUE(draft_id,position), FOREIGN KEY(org_id,draft_id) REFERENCES sale_draft(org_id,id)
);
CREATE TABLE sale_draft_tender (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, draft_id TEXT NOT NULL, position INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash','momo','card')), amount INTEGER NOT NULL,
 reference TEXT, approval_code TEXT, last4 TEXT, phone TEXT, network TEXT,
 status TEXT NOT NULL CHECK(status IN ('applied','pending','otp','confirmed','failed','expired')),
 created_at TEXT NOT NULL,
 UNIQUE(draft_id,position), FOREIGN KEY(org_id,draft_id) REFERENCES sale_draft(org_id,id)
);`;

/**
 * Ordered till SQLite steps driven by PRAGMA user_version. Day 11 collapsed the earlier steps into one fresh
 * schema (tills are re-provisioned, so there is nothing to upgrade from). Shipped steps are never edited again;
 * append new ones.
 */

const payments = `
CREATE TABLE payment_intent (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 branch_id TEXT NOT NULL, cashier_id TEXT NOT NULL, reference TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount > 0 AND amount % 100 = 0), phone TEXT NOT NULL,
 phone_fingerprint TEXT CHECK(phone_fingerprint IS NULL OR (length(phone_fingerprint)=64 AND phone_fingerprint NOT GLOB '*[^0-9a-f]*')),
 network TEXT NOT NULL CHECK(network IN ('mtn','telecel','airteltigo')),
 status TEXT NOT NULL CHECK(status IN ('pending','otp','confirmed','failed','expired')),
 failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(org_id,reference)
);`;

const registers = `
CREATE TABLE till_setting (
 org_id TEXT NOT NULL, device_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL,
 updated_at TEXT NOT NULL, UNIQUE(org_id,device_id)
);
CREATE TABLE receipt_output (
 sale_id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, printed_at TEXT, print_error TEXT,
 reprints INTEGER NOT NULL DEFAULT 0, pdf BLOB, pdf_sha256 TEXT, pdf_size INTEGER, asset_id TEXT,
 uploaded_at TEXT, upload_attempts INTEGER NOT NULL DEFAULT 0, next_upload_at INTEGER,
 FOREIGN KEY(org_id,sale_id) REFERENCES local_sale(org_id,id)
);`;

const stockDocuments = `
CREATE TABLE stock_document (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('count','receipt')), payload TEXT NOT NULL, session_id TEXT NOT NULL,
 created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER,
 blocked_code TEXT, blocked_reason TEXT, accepted_at TEXT, result TEXT
);`;

const staff = `
CREATE TABLE till_staff (
 org_id TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, verifier TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER, verified_at TEXT NOT NULL, last_session_id TEXT,
 PRIMARY KEY(org_id,user_id), UNIQUE(org_id,email)
);`;

const approvers = `
CREATE TABLE till_approver (
 org_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, pin_hash TEXT NOT NULL, permissions TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER, refreshed_at TEXT NOT NULL,
 PRIMARY KEY(org_id,user_id)
);`;

const priceOverrides = `
ALTER TABLE sale_draft_line ADD COLUMN override_price INTEGER;
ALTER TABLE sale_draft_line ADD COLUMN override_approver_id TEXT;
ALTER TABLE sale_draft_line ADD COLUMN override_reason TEXT;`;

export const tillMigrations: string[] = [
  `${initial}${lookup}${drafts}${payments}`,
  registers,
  stockDocuments,
  staff,
  approvers,
  priceOverrides,
];
