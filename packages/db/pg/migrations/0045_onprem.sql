-- Day 43: a cloud shop moves onto its own box. `box_move` is the cloud's record of the shop leaving (open, claimed or
-- archived: the org only reads); `archive_import.report` keeps a box's verification report of what arrived.
-- Replayable.
CREATE TABLE IF NOT EXISTS "box_move" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"requested_by" uuid,
	"export_job_id" uuid NOT NULL,
	"licence_id" uuid,
	"licence" jsonb,
	"box_upstream" text,
	"relocations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report" jsonb,
	"error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "box_move_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "archive_import" ADD COLUMN IF NOT EXISTS "report" jsonb;--> statement-breakpoint
ALTER TABLE "box_move" DROP CONSTRAINT IF EXISTS "box_move_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "box_move" ADD CONSTRAINT "box_move_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
