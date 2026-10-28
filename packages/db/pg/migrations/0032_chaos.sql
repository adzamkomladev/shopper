-- Day 24: an offline session a register started past its server session is recorded as a cashier session
-- that names its parent, and a product's open stock alert has a kind: low or negative. Only additions, so
-- writers from before still run against the same open-alert index. Every statement can be replayed.
ALTER TABLE "cashier_session" ADD COLUMN IF NOT EXISTS "parent_session_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cashier_session" ADD CONSTRAINT "cashier_session_org_id_parent_session_id_cashier_session_org_id_id_fk" FOREIGN KEY ("org_id","parent_session_id") REFERENCES "public"."cashier_session"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "stock_alert" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'low' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_kind" CHECK ("stock_alert"."kind" IN ('low', 'negative'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
