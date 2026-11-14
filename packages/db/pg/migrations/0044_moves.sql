-- Day 42: a box moves to the cloud. `archive_import` is the cloud's record of an incoming archive (its org arrives with
-- the import, so no foreign key); `cloud_move` is the box's record of leaving (once it exists the box is read-only).
-- Replayable.
CREATE TABLE IF NOT EXISTS "archive_import" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"licence_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"signature" text NOT NULL,
	"received" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credentials" jsonb,
	"relocations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "archive_import_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cloud_move" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sealing' NOT NULL,
	"requested_by" uuid,
	"cloud_url" text NOT NULL,
	"export_job_id" uuid,
	"import_id" uuid,
	"relocations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "cloud_move_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "cloud_move" DROP CONSTRAINT IF EXISTS "cloud_move_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "cloud_move" ADD CONSTRAINT "cloud_move_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hidden from archives (never moved), so an imported row takes a value that matches no token anyone holds.
ALTER TABLE "cashier_session" ALTER COLUMN "token_hash" SET DEFAULT ('moved:' || uuidv7());--> statement-breakpoint
ALTER TABLE "registration_request" ALTER COLUMN "verification_digest" SET DEFAULT ('moved:' || uuidv7());--> statement-breakpoint
ALTER TABLE "online_order" ALTER COLUMN "view_token_digest" SET DEFAULT ('moved:' || uuidv7());--> statement-breakpoint
-- An import writes rows exactly as the archive holds them. With `shopper.import` set (SET LOCAL, one transaction), the
-- triggers that would renumber branches and registers or seed a second chart of accounts stand aside.
CREATE OR REPLACE FUNCTION assign_branch_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE counter integer;
BEGIN
 IF current_setting('shopper.import', true) = 'on' THEN RETURN NEW; END IF;
 UPDATE org SET branch_counter = branch_counter + 1 WHERE id = NEW.org_id RETURNING branch_counter INTO counter;
 NEW.code := 'BR' || lpad(counter::text, greatest(2,length(counter::text)), '0'); RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION assign_device_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE counter integer;
BEGIN
 IF current_setting('shopper.import', true) = 'on' THEN RETURN NEW; END IF;
 UPDATE branch SET device_counter = device_counter + 1 WHERE org_id = NEW.org_id AND id = NEW.branch_id RETURNING device_counter INTO counter;
 NEW.code := 'T' || lpad(counter::text, greatest(2,length(counter::text)), '0'); RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_seed_org_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('shopper.import', true) = 'on' THEN RETURN NEW; END IF;
  PERFORM shopper_seed_ledger(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- migration.run: moving the shop to the cloud. Not till-allowed. Granted to the owner and to every role that may
-- export the business (permissions are data, so never by role name); replayable.
INSERT INTO permission (org_id, code, till_allowed)
SELECT o.id, 'migration.run', false FROM org o
WHERE EXISTS (SELECT 1 FROM role r WHERE r.org_id = o.id)
ON CONFLICT (org_id, code) DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM role r
JOIN permission p ON p.org_id = r.org_id AND p.code = 'migration.run'
WHERE r.protected_owner
ON CONFLICT DO NOTHING;
