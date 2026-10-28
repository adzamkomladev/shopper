-- Day 25: a cloud shop's onboarding to its first sale, and its business verification (KYB) for payouts. Every
-- statement replays; the asset policy is dropped and re-added with KYB documents in the durable receipts store.
CREATE TABLE IF NOT EXISTS "onboarding" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"catalogue_at" timestamp with time zone,
	"wizard_done_at" timestamp with time zone,
	"wizard_skipped_at" timestamp with time zone,
	"first_sale_at" timestamp with time zone,
	"nudges" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "onboarding_org_id_unique" UNIQUE("org_id"),
	CONSTRAINT "onboarding_status" CHECK ("onboarding"."status" IN ('setup', 'trading')),
	CONSTRAINT "onboarding_trading" CHECK (("onboarding"."status" = 'trading') = ("onboarding"."first_sale_at" IS NOT NULL)),
	CONSTRAINT "onboarding_nudges" CHECK ("onboarding"."nudges" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyb_case" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"business_name" text,
	"registration_number" text,
	"tin" text,
	"settlement_bank" text,
	"settlement_account" text,
	"directors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_on" date,
	"reviewer_id" text,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"renewal_sent_at" timestamp with time zone,
	"subaccount_code" text,
	CONSTRAINT "kyb_case_org_id_unique" UNIQUE("org_id"),
	CONSTRAINT "kyb_case_status" CHECK ("kyb_case"."status" IN ('draft', 'submitted', 'checks_failed', 'in_review', 'approved', 'rejected', 'expired')),
	CONSTRAINT "kyb_case_version" CHECK ("kyb_case"."version" >= 0),
	CONSTRAINT "kyb_case_decided" CHECK (("kyb_case"."status" IN ('approved', 'rejected', 'expired')) = ("kyb_case"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT IF EXISTS "asset_policy";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "kyb_case" ADD CONSTRAINT "kyb_case_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_policy" CHECK (("asset"."purpose" = 'catalogue_import' AND "asset"."bucket" = 'imports' AND "asset"."expires_at" IS NOT NULL) OR ("asset"."purpose" = 'sync_snapshot' AND "asset"."bucket" = 'snapshots' AND "asset"."expires_at" IS NULL) OR ("asset"."purpose" = 'sale_receipt' AND "asset"."bucket" = 'receipts' AND "asset"."expires_at" IS NULL) OR ("asset"."purpose" = 'kyb_document' AND "asset"."bucket" = 'receipts' AND "asset"."expires_at" IS NULL));