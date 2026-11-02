-- Day 31: the general ledger and the online store's read model.
-- ledger_account is each org's chart (seeded by a trigger on org, and here for orgs that already exist);
-- journal_entry/journal_line are append-only balanced postings; catalogue_public is the only product source the
-- store reads. product.image_asset_id links a verified photo. Replayable.
CREATE TABLE IF NOT EXISTS "ledger_account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"system_key" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "ledger_account_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "ledger_account_code" UNIQUE("org_id","code"),
	CONSTRAINT "ledger_account_system" UNIQUE("org_id","system_key"),
	CONSTRAINT "ledger_account_type" CHECK ("ledger_account"."type" IN ('asset', 'liability', 'equity', 'income', 'expense')),
	CONSTRAINT "ledger_account_code_format" CHECK ("ledger_account"."code" ~ '^[0-9]{4,6}$'),
	CONSTRAINT "ledger_account_system_kept" CHECK ("ledger_account"."system_key" IS NULL OR "ledger_account"."archived_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entry" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_on" date NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid NOT NULL,
	"branch_id" uuid,
	"memo" text NOT NULL,
	"reverses_id" uuid,
	"actor_id" uuid,
	CONSTRAINT "journal_entry_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "journal_entry_source" UNIQUE("org_id","source","source_id"),
	CONSTRAINT "journal_entry_reverses" UNIQUE("org_id","reverses_id"),
	CONSTRAINT "journal_entry_source_kind" CHECK ("journal_entry"."source" IN ('sale', 'refund', 'credit', 'loyalty', 'shift', 'stock', 'settlement', 'manual', 'reversal')),
	CONSTRAINT "journal_entry_reversal" CHECK (("journal_entry"."source" = 'reversal') = ("journal_entry"."reverses_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"posted_on" date NOT NULL,
	"branch_id" uuid,
	"memo" text,
	CONSTRAINT "journal_line_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "journal_line_amount" CHECK ("journal_line"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT IF EXISTS "asset_policy";--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "ledger_locked_through" date;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "image_asset_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_org_id_actor_id_user_org_id_id_fk" FOREIGN KEY ("org_id","actor_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_org_id_reverses_id_journal_entry_org_id_id_fk" FOREIGN KEY ("org_id","reverses_id") REFERENCES "public"."journal_entry"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_org_id_entry_id_journal_entry_org_id_id_fk" FOREIGN KEY ("org_id","entry_id") REFERENCES "public"."journal_entry"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_org_id_account_id_ledger_account_org_id_id_fk" FOREIGN KEY ("org_id","account_id") REFERENCES "public"."ledger_account"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entry_posted" ON "journal_entry" USING btree ("org_id","posted_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_line_entry" ON "journal_line" USING btree ("org_id","entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_line_account" ON "journal_line" USING btree ("org_id","account_id","posted_on");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "product" ADD CONSTRAINT "product_org_id_image_asset_id_asset_org_id_id_fk" FOREIGN KEY ("org_id","image_asset_id") REFERENCES "public"."asset"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "asset" ADD CONSTRAINT "asset_policy" CHECK (("asset"."purpose" = 'catalogue_import' AND "asset"."bucket" = 'imports' AND "asset"."expires_at" IS NOT NULL) OR ("asset"."purpose" = 'sync_snapshot' AND "asset"."bucket" = 'snapshots' AND "asset"."expires_at" IS NULL) OR ("asset"."purpose" = 'sale_receipt' AND "asset"."bucket" = 'receipts' AND "asset"."expires_at" IS NULL) OR ("asset"."purpose" = 'kyb_document' AND "asset"."bucket" = 'receipts' AND "asset"."expires_at" IS NULL) OR ("asset"."purpose" = 'product_image' AND "asset"."bucket" = 'receipts' AND "asset"."expires_at" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_seed_ledger(target uuid) RETURNS void LANGUAGE sql AS $$
  INSERT INTO ledger_account (org_id, code, name, type, system_key)
  SELECT target, a.code, a.name, a.type, a.system_key
  FROM (VALUES
    ('1000', 'Cash in drawers', 'asset', 'cash_drawer'),
    ('1010', 'Cash in safe', 'asset', 'cash_safe'),
    ('1020', 'Bank', 'asset', 'bank'),
    ('1030', 'MoMo clearing', 'asset', 'momo_clearing'),
    ('1040', 'Card clearing', 'asset', 'card_clearing'),
    ('1100', 'Customer accounts', 'asset', 'receivables'),
    ('1200', 'Inventory', 'asset', 'inventory'),
    ('2000', 'Goods received, not billed', 'liability', 'goods_received'),
    ('2100', 'VAT payable', 'liability', 'vat'),
    ('2110', 'NHIL payable', 'liability', 'nhil'),
    ('2120', 'GETFund levy payable', 'liability', 'getfund'),
    ('2130', 'COVID-19 levy payable', 'liability', 'covid'),
    ('2300', 'Loyalty points', 'liability', 'loyalty'),
    ('3000', 'Owner''s equity', 'equity', 'owner_equity'),
    ('3100', 'Retained earnings', 'equity', 'retained_earnings'),
    ('4000', 'Sales', 'income', 'sales'),
    ('4010', 'Sales returns', 'income', 'sales_returns'),
    ('4100', 'Account interest', 'income', 'interest'),
    ('4200', 'Cash rounding', 'income', 'rounding'),
    ('4300', 'Cash over/short', 'income', 'over_short'),
    ('5000', 'Cost of goods sold', 'expense', 'cogs'),
    ('5100', 'Stock shrinkage', 'expense', 'shrinkage'),
    ('5200', 'Payment fees', 'expense', 'fees'),
    ('5300', 'Loyalty rewards', 'expense', 'rewards')
  ) AS a(code, name, type, system_key)
  ON CONFLICT DO NOTHING;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_seed_org_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM shopper_seed_ledger(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER org_seed_ledger AFTER INSERT ON org
FOR EACH ROW EXECUTE FUNCTION shopper_seed_org_ledger();
--> statement-breakpoint
SELECT shopper_seed_ledger(id) FROM org;
--> statement-breakpoint
-- An entry must balance and have two lines by commit; checked once per touched entry, deferred so the lines of one
-- posting can be inserted one statement at a time.
CREATE OR REPLACE FUNCTION shopper_check_journal_entry(target_org uuid, entry uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  total numeric;
  lines integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO total, lines
  FROM journal_line WHERE org_id = target_org AND entry_id = entry;
  IF total <> 0 OR lines < 2 THEN
    RAISE EXCEPTION 'Journal entry % does not balance (% over % lines)', entry, total, lines
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_check_entry_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM shopper_check_journal_entry(NEW.org_id, NEW.id);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_check_line_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM shopper_check_journal_entry(NEW.org_id, NEW.entry_id);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS journal_entry_balanced ON journal_entry;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entry_balanced AFTER INSERT ON journal_entry
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shopper_check_entry_balance();
--> statement-breakpoint
DROP TRIGGER IF EXISTS journal_line_balanced ON journal_line;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_line_balanced AFTER INSERT ON journal_line
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shopper_check_line_balance();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER journal_entry_append_only BEFORE UPDATE OR DELETE ON journal_entry
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER journal_line_append_only BEFORE UPDATE OR DELETE ON journal_line
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER journal_entry_no_truncate BEFORE TRUNCATE ON journal_entry
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER journal_line_no_truncate BEFORE TRUNCATE ON journal_line
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE VIEW catalogue_public AS
SELECT org_id, id AS product_id, sku, name, category_id, base_unit, image_asset_id
FROM product
WHERE online_visible AND archived_at IS NULL;
