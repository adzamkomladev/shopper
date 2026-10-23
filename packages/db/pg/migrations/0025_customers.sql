ALTER TABLE org ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS loyalty_earn_bps integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS loyalty_point_value bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS loyalty_expiry_days integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS tier_notice_days integer NOT NULL DEFAULT 14;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS credit_terms_days integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS credit_interest_bps integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS statement_schedule text NOT NULL DEFAULT 'off';
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS statement_day integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS statement_channels text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS statement_min_balance bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS kyc_id_required boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS kyc_id_types text[] NOT NULL DEFAULT '{ghana_card,passport,voter_id,drivers_licence}';
--> statement-breakpoint
ALTER TABLE org DROP CONSTRAINT IF EXISTS org_loyalty;
--> statement-breakpoint
ALTER TABLE org ADD CONSTRAINT org_loyalty CHECK (loyalty_earn_bps BETWEEN 0 AND 10000 AND loyalty_point_value >= 0 AND loyalty_expiry_days >= 0 AND tier_notice_days >= 0 AND (NOT loyalty_enabled OR loyalty_point_value > 0));
--> statement-breakpoint
ALTER TABLE org DROP CONSTRAINT IF EXISTS org_credit;
--> statement-breakpoint
ALTER TABLE org ADD CONSTRAINT org_credit CHECK (credit_terms_days >= 0 AND credit_interest_bps BETWEEN 0 AND 10000);
--> statement-breakpoint
ALTER TABLE org DROP CONSTRAINT IF EXISTS org_statements;
--> statement-breakpoint
ALTER TABLE org ADD CONSTRAINT org_statements CHECK (statement_schedule IN ('off', 'monthly') AND statement_day BETWEEN 1 AND 28 AND statement_channels <@ ARRAY['sms', 'email']::text[] AND statement_min_balance >= 0 AND (statement_schedule = 'off' OR cardinality(statement_channels) > 0));
--> statement-breakpoint
ALTER TABLE org DROP CONSTRAINT IF EXISTS org_kyc;
--> statement-breakpoint
ALTER TABLE org ADD CONSTRAINT org_kyc CHECK (kyc_id_types <@ ARRAY['ghana_card', 'passport', 'voter_id', 'drivers_licence']::text[] AND (NOT kyc_id_required OR cardinality(kyc_id_types) > 0));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text NOT NULL,
  kind text NOT NULL DEFAULT 'individual',
  business_name text,
  tin text,
  email text,
  credit_limit bigint NOT NULL DEFAULT 0,
  kyc_verified_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  merged_into_id uuid,
  created_device_id uuid,
  CONSTRAINT customer_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT customer_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT customer_org_id_merged_into_id_customer_org_id_id_fk FOREIGN KEY (org_id, merged_into_id) REFERENCES customer(org_id, id),
  CONSTRAINT customer_org_id_created_device_id_device_org_id_id_fk FOREIGN KEY (org_id, created_device_id) REFERENCES device(org_id, id),
  CONSTRAINT customer_kind CHECK (kind IN ('individual', 'business')),
  CONSTRAINT customer_phone CHECK (phone ~ '^0[0-9]{9}$'),
  CONSTRAINT customer_business CHECK (kind <> 'business' OR (business_name IS NOT NULL AND business_name <> '')),
  CONSTRAINT customer_tin CHECK (tin IS NULL OR tin ~ '^(?:[A-Z][0-9]{10}|GHA-[0-9]{9}-[0-9])$'),
  CONSTRAINT customer_credit_limit CHECK (credit_limit >= 0),
  CONSTRAINT customer_credit_kyc CHECK (credit_limit = 0 OR kyc_verified_at IS NOT NULL),
  CONSTRAINT customer_merged CHECK (merged_into_id IS NULL OR archived_at IS NOT NULL),
  CONSTRAINT customer_version_positive CHECK (version > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customer_phone ON customer USING btree (org_id, phone);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customer_name ON customer USING btree (org_id, lower(name));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_hold (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  kind text NOT NULL,
  amount bigint,
  points integer,
  point_value bigint,
  branch_id uuid NOT NULL,
  device_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'held',
  sale_id uuid,
  CONSTRAINT account_hold_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT account_hold_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT account_hold_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT account_hold_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT account_hold_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT account_hold_org_id_cashier_id_user_org_id_id_fk FOREIGN KEY (org_id, cashier_id) REFERENCES "user"(org_id, id),
  CONSTRAINT account_hold_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT account_hold_kind CHECK (kind IN ('credit', 'loyalty')),
  CONSTRAINT account_hold_status CHECK (status IN ('held', 'consumed', 'released')),
  CONSTRAINT account_hold_size CHECK ((kind = 'credit' AND amount > 0 AND points IS NULL AND point_value IS NULL)
    OR (kind = 'loyalty' AND points > 0 AND point_value > 0 AND amount IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_hold_customer ON account_hold USING btree (org_id, customer_id, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS credit_entry (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  kind text NOT NULL,
  amount bigint NOT NULL,
  sale_id uuid,
  refund_id uuid,
  hold_id uuid,
  method text,
  shift_id uuid,
  reason text,
  period text,
  actor_id uuid,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT credit_entry_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT credit_entry_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT credit_entry_org_id_hold_id_unique UNIQUE (org_id, hold_id),
  CONSTRAINT credit_entry_org_id_customer_id_period_unique UNIQUE (org_id, customer_id, period),
  CONSTRAINT credit_entry_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT credit_entry_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT credit_entry_org_id_refund_id_refund_org_id_id_fk FOREIGN KEY (org_id, refund_id) REFERENCES refund(org_id, id),
  CONSTRAINT credit_entry_org_id_hold_id_account_hold_org_id_id_fk FOREIGN KEY (org_id, hold_id) REFERENCES account_hold(org_id, id),
  CONSTRAINT credit_entry_org_id_actor_id_user_org_id_id_fk FOREIGN KEY (org_id, actor_id) REFERENCES "user"(org_id, id),
  CONSTRAINT credit_entry_kind CHECK (kind IN ('charge', 'payment', 'credit_note', 'interest', 'transfer')),
  CONSTRAINT credit_entry_sign CHECK (kind = 'transfer' OR (kind IN ('charge', 'interest') AND amount > 0)
    OR (kind IN ('payment', 'credit_note') AND amount < 0)),
  CONSTRAINT credit_entry_amount CHECK (amount <> 0),
  CONSTRAINT credit_entry_method CHECK ((kind = 'payment') = (method IS NOT NULL)),
  CONSTRAINT credit_entry_method_value CHECK (method IS NULL OR method IN ('cash', 'momo', 'card')),
  CONSTRAINT credit_entry_reason CHECK (kind <> 'credit_note' OR (reason IS NOT NULL AND reason <> '')),
  CONSTRAINT credit_entry_period CHECK ((kind = 'interest') = (period IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS credit_entry_customer ON credit_entry USING btree (org_id, customer_id, occurred_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS loyalty_entry (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  reason text NOT NULL,
  points integer NOT NULL,
  sale_id uuid,
  refund_id uuid,
  hold_id uuid,
  rate_bps integer,
  point_value bigint,
  lot_id uuid,
  actor_id uuid,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT loyalty_entry_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT loyalty_entry_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT loyalty_entry_org_id_hold_id_unique UNIQUE (org_id, hold_id),
  CONSTRAINT loyalty_entry_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT loyalty_entry_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT loyalty_entry_org_id_refund_id_refund_org_id_id_fk FOREIGN KEY (org_id, refund_id) REFERENCES refund(org_id, id),
  CONSTRAINT loyalty_entry_org_id_hold_id_account_hold_org_id_id_fk FOREIGN KEY (org_id, hold_id) REFERENCES account_hold(org_id, id),
  CONSTRAINT loyalty_entry_org_id_lot_id_loyalty_entry_org_id_id_fk FOREIGN KEY (org_id, lot_id) REFERENCES loyalty_entry(org_id, id),
  CONSTRAINT loyalty_entry_org_id_actor_id_user_org_id_id_fk FOREIGN KEY (org_id, actor_id) REFERENCES "user"(org_id, id),
  CONSTRAINT loyalty_entry_reason CHECK (reason IN ('earn', 'redeem', 'reverse', 'expire', 'transfer')),
  CONSTRAINT loyalty_entry_points CHECK (points <> 0),
  CONSTRAINT loyalty_entry_sign CHECK ((reason = 'earn' AND points > 0) OR (reason IN ('redeem', 'expire') AND points < 0) OR reason IN ('reverse', 'transfer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_entry_earn_sale ON loyalty_entry USING btree (org_id, sale_id) WHERE reason = 'earn';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_entry_expire_lot ON loyalty_entry USING btree (org_id, lot_id) WHERE reason = 'expire';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS loyalty_entry_customer ON loyalty_entry USING btree (org_id, customer_id, occurred_at);
--> statement-breakpoint
CREATE OR REPLACE TRIGGER credit_entry_append_only BEFORE UPDATE OR DELETE ON credit_entry
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER credit_entry_no_truncate BEFORE TRUNCATE ON credit_entry
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER loyalty_entry_append_only BEFORE UPDATE OR DELETE ON loyalty_entry
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER loyalty_entry_no_truncate BEFORE TRUNCATE ON loyalty_entry
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS loyalty_tier (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  min_spend bigint NOT NULL,
  earn_bps integer NOT NULL,
  archived_at timestamptz,
  CONSTRAINT loyalty_tier_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT loyalty_tier_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT loyalty_tier_values CHECK (min_spend >= 0 AND earn_bps BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS tier_notice (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  from_tier_id uuid NOT NULL,
  to_tier_id uuid,
  effective_on date NOT NULL,
  sent_at timestamptz,
  channel text,
  CONSTRAINT tier_notice_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT tier_notice_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT tier_notice_org_id_customer_id_from_tier_id_effective_on_unique UNIQUE (org_id, customer_id, from_tier_id, effective_on),
  CONSTRAINT tier_notice_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT tier_notice_org_id_from_tier_id_loyalty_tier_org_id_id_fk FOREIGN KEY (org_id, from_tier_id) REFERENCES loyalty_tier(org_id, id),
  CONSTRAINT tier_notice_org_id_to_tier_id_loyalty_tier_org_id_id_fk FOREIGN KEY (org_id, to_tier_id) REFERENCES loyalty_tier(org_id, id),
  CONSTRAINT tier_notice_channel CHECK (channel IS NULL OR channel IN ('sms', 'email')),
  CONSTRAINT tier_notice_sent CHECK ((sent_at IS NULL) = (channel IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS statement_link (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  CONSTRAINT statement_link_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT statement_link_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT statement_link_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT statement_link_org_id_created_by_user_org_id_id_fk FOREIGN KEY (org_id, created_by) REFERENCES "user"(org_id, id),
  CONSTRAINT statement_link_period CHECK (period_from <= period_to),
  CONSTRAINT statement_link_views CHECK (view_count >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS statement_delivery (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  link_id uuid,
  channel text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_reference text,
  actor_id uuid,
  CONSTRAINT statement_delivery_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT statement_delivery_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT statement_delivery_period UNIQUE (org_id, customer_id, period_from, period_to, channel),
  CONSTRAINT statement_delivery_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT statement_delivery_org_id_link_id_statement_link_org_id_id_fk FOREIGN KEY (org_id, link_id) REFERENCES statement_link(org_id, id),
  CONSTRAINT statement_delivery_org_id_actor_id_user_org_id_id_fk FOREIGN KEY (org_id, actor_id) REFERENCES "user"(org_id, id),
  CONSTRAINT statement_delivery_channel CHECK (channel IN ('sms', 'email', 'pdf')),
  CONSTRAINT statement_delivery_status CHECK (status IN ('queued', 'sent', 'failed')),
  CONSTRAINT statement_delivery_period_order CHECK (period_from <= period_to)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS kyc_case (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid,
  member_id uuid,
  purpose text NOT NULL,
  requested_limit bigint,
  requested_role_id uuid,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'otp_sent',
  otp_digest text,
  otp_expires_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  otp_sends integer NOT NULL DEFAULT 0,
  id_type text,
  id_fingerprint text,
  id_masked text,
  full_name text,
  id_sighted boolean NOT NULL DEFAULT false,
  opened_by uuid NOT NULL,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  approved_limit bigint,
  approved_role_id uuid,
  decision_due_at timestamptz,
  CONSTRAINT kyc_case_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT kyc_case_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT kyc_case_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id),
  CONSTRAINT kyc_case_org_id_member_id_user_org_id_id_fk FOREIGN KEY (org_id, member_id) REFERENCES "user"(org_id, id),
  CONSTRAINT kyc_case_org_id_requested_role_id_role_org_id_id_fk FOREIGN KEY (org_id, requested_role_id) REFERENCES role(org_id, id),
  CONSTRAINT kyc_case_org_id_approved_role_id_role_org_id_id_fk FOREIGN KEY (org_id, approved_role_id) REFERENCES role(org_id, id),
  CONSTRAINT kyc_case_org_id_opened_by_user_org_id_id_fk FOREIGN KEY (org_id, opened_by) REFERENCES "user"(org_id, id),
  CONSTRAINT kyc_case_org_id_decided_by_user_org_id_id_fk FOREIGN KEY (org_id, decided_by) REFERENCES "user"(org_id, id),
  CONSTRAINT kyc_case_purpose CHECK (purpose IN ('credit', 'role')),
  CONSTRAINT kyc_case_status CHECK (status IN ('otp_sent', 'id_needed', 'review', 'approved', 'rejected', 'expired')),
  CONSTRAINT kyc_case_id_type CHECK (id_type IS NULL OR id_type IN ('ghana_card', 'passport', 'voter_id', 'drivers_licence')),
  CONSTRAINT kyc_case_subject CHECK ((customer_id IS NULL) <> (member_id IS NULL)),
  CONSTRAINT kyc_case_request CHECK ((purpose = 'credit' AND customer_id IS NOT NULL AND requested_limit > 0 AND requested_role_id IS NULL)
    OR (purpose = 'role' AND member_id IS NOT NULL AND requested_role_id IS NOT NULL AND requested_limit IS NULL)),
  CONSTRAINT kyc_case_id CHECK ((id_type IS NULL) = (id_fingerprint IS NULL) AND (id_type IS NULL) = (id_masked IS NULL)),
  CONSTRAINT kyc_case_decision CHECK ((decided_by IS NULL) = (decided_at IS NULL) AND (status NOT IN ('approved', 'rejected') OR decided_by IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS kyc_case_open_customer ON kyc_case USING btree (org_id, customer_id) WHERE customer_id IS NOT NULL AND status IN ('otp_sent', 'id_needed', 'review');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS kyc_case_open_member ON kyc_case USING btree (org_id, member_id) WHERE member_id IS NOT NULL AND status IN ('otp_sent', 'id_needed', 'review');
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS customer_id uuid;
--> statement-breakpoint
ALTER TABLE sale DROP CONSTRAINT IF EXISTS sale_org_id_customer_id_customer_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE sale ADD CONSTRAINT sale_org_id_customer_id_customer_org_id_id_fk FOREIGN KEY (org_id, customer_id) REFERENCES customer(org_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sale_customer ON sale USING btree (org_id, customer_id);
--> statement-breakpoint
ALTER TABLE sale_tender ADD COLUMN IF NOT EXISTS hold_id uuid;
--> statement-breakpoint
ALTER TABLE sale_tender DROP CONSTRAINT IF EXISTS sale_tender_org_id_hold_id_unique;
--> statement-breakpoint
ALTER TABLE sale_tender ADD CONSTRAINT sale_tender_org_id_hold_id_unique UNIQUE (org_id, hold_id);
--> statement-breakpoint
ALTER TABLE sale_tender DROP CONSTRAINT IF EXISTS sale_tender_org_id_hold_id_account_hold_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE sale_tender ADD CONSTRAINT sale_tender_org_id_hold_id_account_hold_org_id_id_fk FOREIGN KEY (org_id, hold_id) REFERENCES account_hold(org_id, id);
--> statement-breakpoint
ALTER TABLE sale_tender DROP CONSTRAINT IF EXISTS sale_tender_kind;
--> statement-breakpoint
ALTER TABLE sale_tender ADD CONSTRAINT sale_tender_kind CHECK (kind IN ('cash', 'momo', 'card', 'credit', 'loyalty'));
--> statement-breakpoint
ALTER TABLE sale_tender DROP CONSTRAINT IF EXISTS sale_tender_hold;
--> statement-breakpoint
ALTER TABLE sale_tender ADD CONSTRAINT sale_tender_hold CHECK ((kind IN ('credit', 'loyalty')) = (hold_id IS NOT NULL));
--> statement-breakpoint
ALTER TABLE refund ADD COLUMN IF NOT EXISTS account_credit bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE refund ADD COLUMN IF NOT EXISTS points_returned integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE refund DROP CONSTRAINT IF EXISTS refund_account;
--> statement-breakpoint
ALTER TABLE refund ADD CONSTRAINT refund_account CHECK (account_credit >= 0 AND points_returned >= 0);
--> statement-breakpoint
ALTER TABLE store_change DROP CONSTRAINT IF EXISTS store_change_entity;
--> statement-breakpoint
ALTER TABLE store_change ADD CONSTRAINT store_change_entity CHECK (entity IN ('product', 'price', 'tax-rule', 'barcode-mapping', 'customer'));
--> statement-breakpoint
INSERT INTO permission (org_id, code, till_allowed)
SELECT o.id, p.code, p.till_allowed FROM org o
CROSS JOIN (VALUES ('customer.read', true), ('customer.write', true), ('customer.manage', false), ('kyc.approve', false)) p(code, till_allowed)
WHERE EXISTS (SELECT 1 FROM role r WHERE r.org_id = o.id)
ON CONFLICT (org_id, code) DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM role r
JOIN permission p ON p.org_id = r.org_id
WHERE ((r.protected_owner OR r.name IN ('superadmin', 'admin')) AND p.code IN ('customer.read', 'customer.write', 'customer.manage', 'kyc.approve'))
   OR (r.name = 'accountant' AND p.code IN ('customer.read', 'customer.manage'))
   OR (r.name = 'cashier' AND p.code IN ('customer.read', 'customer.write'))
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
