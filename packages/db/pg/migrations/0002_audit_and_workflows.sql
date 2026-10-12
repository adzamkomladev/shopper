CREATE TABLE "workflow_run" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"instance_id" text NOT NULL,
	"type" text NOT NULL,
	"business_key" text NOT NULL,
	"status" text NOT NULL,
	"current_step" text NOT NULL,
	CONSTRAINT "workflow_run_org_id_instance_id_unique" UNIQUE("org_id","instance_id"),
	CONSTRAINT "workflow_business_key" CHECK ("workflow_run"."instance_id" = "workflow_run"."business_key"),
	CONSTRAINT "workflow_status" CHECK ("workflow_run"."status" IN ('running', 'waiting', 'completed', 'failed', 'compensating', 'compensated'))
);
--> statement-breakpoint
CREATE TABLE "workflow_step" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"instance_id" text NOT NULL,
	"name" text NOT NULL,
	"output" jsonb NOT NULL,
	CONSTRAINT "workflow_step_org_id_instance_id_name_unique" UNIQUE("org_id","instance_id","name")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "after" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "approver_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "device_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "chain_seq" bigint;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "prev_hash" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "hash" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "last_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step" ADD CONSTRAINT "workflow_step_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step" ADD CONSTRAINT "workflow_step_org_id_instance_id_workflow_run_org_id_instance_id_fk" FOREIGN KEY ("org_id","instance_id") REFERENCES "public"."workflow_run"("org_id","instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_step_org_id_instance_id_index" ON "workflow_step" USING btree ("org_id","instance_id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_approver_id_user_org_id_id_fk" FOREIGN KEY ("org_id","approver_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_device_id_device_org_id_id_fk" FOREIGN KEY ("org_id","device_id") REFERENCES "public"."device"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_chain_seq_unique" UNIQUE("org_id","chain_seq");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_chain_shape" CHECK (("audit_log"."hash" IS NULL AND "audit_log"."prev_hash" IS NULL AND "audit_log"."chain_seq" IS NULL) OR ("audit_log"."hash" IS NOT NULL AND "audit_log"."prev_hash" IS NOT NULL AND "audit_log"."chain_seq" IS NOT NULL AND "audit_log"."hash" ~ '^[0-9a-f]{64}$' AND "audit_log"."prev_hash" ~ '^[0-9a-f]{64}$' AND "audit_log"."chain_seq" > 0));--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_sequence_nonnegative" CHECK ("store"."last_seq" >= 0);
--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON workflow_run
FOR EACH ROW EXECUTE FUNCTION shopper_touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER workflow_step_append_only BEFORE UPDATE OR DELETE ON workflow_step
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE TRIGGER workflow_step_no_truncate BEFORE TRUNCATE ON workflow_step
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_require_audit_hash() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hash IS NULL OR NEW.prev_hash IS NULL OR NEW.chain_seq IS NULL THEN
    RAISE EXCEPTION 'New audit entries require a hash chain';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_require_hash BEFORE INSERT ON audit_log
FOR EACH ROW EXECUTE FUNCTION shopper_require_audit_hash();
