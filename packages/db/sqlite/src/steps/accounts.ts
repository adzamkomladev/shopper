// Till SQLite steps for customer accounts; shipped steps are never edited again.

// Account tenders spend a server hold whose id is the tender id; loyalty also records the points it spends.
export const accountTenders = `
CREATE TABLE sale_draft_tender_next (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, draft_id TEXT NOT NULL, position INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash','momo','card','credit','loyalty')), amount INTEGER NOT NULL,
 reference TEXT, approval_code TEXT, last4 TEXT, phone TEXT, network TEXT,
 status TEXT NOT NULL CHECK(status IN ('applied','pending','otp','confirmed','failed','expired')),
 created_at TEXT NOT NULL, points INTEGER CHECK(points IS NULL OR points > 0),
 UNIQUE(draft_id,position), FOREIGN KEY(org_id,draft_id) REFERENCES sale_draft(org_id,id)
);
INSERT INTO sale_draft_tender_next (id, org_id, draft_id, position, kind, amount, reference, approval_code,
 last4, phone, network, status, created_at)
SELECT id, org_id, draft_id, position, kind, amount, reference, approval_code, last4, phone, network, status,
 created_at FROM sale_draft_tender;
DROP TABLE sale_draft_tender;
ALTER TABLE sale_draft_tender_next RENAME TO sale_draft_tender;`;

// Cash and MoMo taken on an account at the drawer: a document per payment, uploaded after its customer.
export const accountPayments = `
CREATE TABLE account_payment (
 id TEXT PRIMARY KEY NOT NULL, org_id TEXT NOT NULL, device_id TEXT NOT NULL, shift_id TEXT NOT NULL,
 customer_id TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN ('cash','momo')),
 amount INTEGER NOT NULL CHECK(amount > 0), payload TEXT NOT NULL, session_id TEXT NOT NULL, created_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER,
 blocked_code TEXT, blocked_reason TEXT, accepted_at TEXT, result TEXT
);
CREATE INDEX account_payment_shift ON account_payment(org_id,shift_id);
CREATE INDEX account_payment_customer ON account_payment(org_id,customer_id);`;
