ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_attempts integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_locked_until timestamptz;
