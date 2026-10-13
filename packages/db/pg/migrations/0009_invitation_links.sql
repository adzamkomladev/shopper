ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "role_id" uuid;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "token_digest" text;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "consumed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_org_id_role_id_role_org_id_id_fk" FOREIGN KEY ("org_id","role_id") REFERENCES "public"."role"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
