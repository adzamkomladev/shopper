CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"command" text NOT NULL,
	"actor_id" uuid,
	"app_version" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "branch_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "device_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "org" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid GENERATED ALWAYS AS (id) STORED NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'full' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "org_mode" CHECK ("org"."mode" IN ('full', 'relay'))
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "permission_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "permission_org_id_code_unique" UNIQUE("org_id","code")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "role_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "role_org_id_name_unique" UNIQUE("org_id","name")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_org_id_role_id_permission_id_unique" UNIQUE("org_id","role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "shopper_meta" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_version" text NOT NULL,
	"schema_version" integer NOT NULL,
	"sync_protocol" integer NOT NULL,
	"archive_format" integer NOT NULL,
	"event" text NOT NULL,
	CONSTRAINT "meta_event" CHECK ("shopper_meta"."event" IN ('install', 'upgrade')),
	CONSTRAINT "meta_versions" CHECK ("shopper_meta"."schema_version" > 0 AND "shopper_meta"."sync_protocol" > 0 AND "shopper_meta"."archive_format" > 0)
);
--> statement-breakpoint
CREATE TABLE "store" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"cash_rounding_step" bigint DEFAULT 100 NOT NULL,
	CONSTRAINT "store_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "positive_cash_rounding_step" CHECK ("store"."cash_rounding_step" > 0)
);
--> statement-breakpoint
CREATE TABLE "tax_class" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tax_class_org_id_code_unique" UNIQUE("org_id","code"),
	CONSTRAINT "tax_class_code" CHECK ("tax_class"."code" IN ('standard', 'zero-rated', 'exempt'))
);
--> statement-breakpoint
CREATE TABLE "tax_rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_from" date NOT NULL,
	"vat_bps" integer NOT NULL,
	"nhil_bps" integer NOT NULL,
	"getfund_bps" integer NOT NULL,
	"covid_bps" integer NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "tax_rule_org_id_effective_from_unique" UNIQUE("org_id","effective_from"),
	CONSTRAINT "tax_rates" CHECK ("tax_rule"."vat_bps" BETWEEN 0 AND 10000 AND "tax_rule"."nhil_bps" BETWEEN 0 AND 10000 AND "tax_rule"."getfund_bps" BETWEEN 0 AND 10000 AND "tax_rule"."covid_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "user_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "user_org_id_email_unique" UNIQUE("org_id","email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_actor_id_user_org_id_id_fk" FOREIGN KEY ("org_id","actor_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_org_id_store_id_store_org_id_id_fk" FOREIGN KEY ("org_id","store_id") REFERENCES "public"."store"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission" ADD CONSTRAINT "permission_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_org_id_role_id_role_org_id_id_fk" FOREIGN KEY ("org_id","role_id") REFERENCES "public"."role"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_org_id_permission_id_permission_org_id_id_fk" FOREIGN KEY ("org_id","permission_id") REFERENCES "public"."permission"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopper_meta" ADD CONSTRAINT "shopper_meta_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_class" ADD CONSTRAINT "tax_class_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;