CREATE TABLE IF NOT EXISTS "registration_request" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid GENERATED ALWAYS AS (id) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"shop_name" text NOT NULL,
	"shop_code" text NOT NULL,
	"verification_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registration_workflow_run" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"type" text NOT NULL,
	"business_key" text NOT NULL,
	"status" text NOT NULL,
	"current_step" text NOT NULL,
	CONSTRAINT "registration_workflow_run_org_id_instance_id_unique" UNIQUE("org_id","instance_id"),
	CONSTRAINT "registration_workflow_business_key" CHECK ("registration_workflow_run"."instance_id" = "registration_workflow_run"."business_key"),
	CONSTRAINT "registration_workflow_status" CHECK ("registration_workflow_run"."status" IN ('running', 'waiting', 'completed', 'failed', 'compensating', 'compensated')),
	CONSTRAINT "registration_workflow_run_org_id_registration_request_id_fk" FOREIGN KEY ("org_id") REFERENCES "registration_request"("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registration_workflow_step" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"name" text NOT NULL,
	"output" jsonb NOT NULL,
	CONSTRAINT "registration_workflow_step_org_id_instance_id_name_unique" UNIQUE("org_id","instance_id","name"),
	CONSTRAINT "registration_workflow_step_org_id_registration_request_id_fk" FOREIGN KEY ("org_id") REFERENCES "registration_request"("id"),
	CONSTRAINT "registration_workflow_step_org_id_instance_id_registration_workflow_run_org_id_instance_id_fk" FOREIGN KEY ("org_id","instance_id") REFERENCES "registration_workflow_run"("org_id","instance_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registration_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"command" text NOT NULL,
	"role" text,
	"device_id" uuid,
	"branch_id" uuid,
	"entity" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"approver_id" uuid,
	"device_time" timestamp with time zone,
	"chain_seq" bigint,
	"prev_hash" text,
	"hash" text,
	"actor_id" uuid,
	"app_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "registration_audit_log_org_id_chain_seq_unique" UNIQUE("org_id","chain_seq"),
	CONSTRAINT "registration_audit_chain_shape" CHECK ("registration_audit_log"."hash" IS NOT NULL AND "registration_audit_log"."prev_hash" IS NOT NULL AND "registration_audit_log"."chain_seq" IS NOT NULL AND "registration_audit_log"."hash" ~ '^[0-9a-f]{64}$' AND "registration_audit_log"."prev_hash" ~ '^[0-9a-f]{64}$' AND "registration_audit_log"."chain_seq" > 0),
	CONSTRAINT "registration_audit_log_org_id_registration_request_id_fk" FOREIGN KEY ("org_id") REFERENCES "registration_request"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_request_email_index" ON "registration_request" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_workflow_step_org_id_instance_id_index" ON "registration_workflow_step" USING btree ("org_id","instance_id");
--> statement-breakpoint
CREATE OR REPLACE TRIGGER touch_updated_at_registration_request BEFORE UPDATE ON registration_request
FOR EACH ROW EXECUTE FUNCTION shopper_touch_updated_at();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER touch_updated_at_registration_workflow_run BEFORE UPDATE ON registration_workflow_run
FOR EACH ROW EXECUTE FUNCTION shopper_touch_updated_at();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER registration_audit_log_append_only BEFORE UPDATE OR DELETE ON registration_audit_log
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER registration_audit_log_no_truncate BEFORE TRUNCATE ON registration_audit_log
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER registration_workflow_step_append_only BEFORE UPDATE OR DELETE ON registration_workflow_step
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER registration_workflow_step_no_truncate BEFORE TRUNCATE ON registration_workflow_step
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
