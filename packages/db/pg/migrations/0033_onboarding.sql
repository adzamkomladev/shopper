-- Day 25: a cloud shop's onboarding from provisioning to its first sale. Only additions; every statement replays.
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
DO $$ BEGIN
  ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;