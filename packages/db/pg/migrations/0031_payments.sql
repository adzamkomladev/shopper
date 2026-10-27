-- Day 23: provider events, MoMo refunds, settlements, remote approvals, subscriptions and invoices, receipt
-- emails, and the MoMo provider on org and payment. Every statement can be replayed.
CREATE TABLE IF NOT EXISTS "payment_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"key" text NOT NULL,
	"reference" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "payment_event_org_id_provider_key_unique" UNIQUE("org_id","provider","key"),
	CONSTRAINT "payment_event_provider" CHECK ("payment_event"."provider" IN ('paystack', 'hubtel'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_refund" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_id" uuid NOT NULL,
	"refund_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"failure_reason" text,
	CONSTRAINT "payment_refund_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "payment_refund_org_id_refund_id_payment_id_unique" UNIQUE("org_id","refund_id","payment_id"),
	CONSTRAINT "payment_refund_amount" CHECK ("payment_refund"."amount" > 0 AND "payment_refund"."amount" % 100 = 0),
	CONSTRAINT "payment_refund_status" CHECK ("payment_refund"."status" IN ('pending', 'processed', 'failed', 'manual'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"settled_on" date NOT NULL,
	"amount" bigint NOT NULL,
	"fees" bigint NOT NULL,
	CONSTRAINT "settlement_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "settlement_org_id_provider_provider_id_unique" UNIQUE("org_id","provider","provider_id"),
	CONSTRAINT "settlement_provider" CHECK ("settlement"."provider" IN ('paystack', 'hubtel'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlement_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"fee" bigint NOT NULL,
	"flag" text NOT NULL,
	CONSTRAINT "settlement_line_org_id_settlement_id_payment_id_unique" UNIQUE("org_id","settlement_id","payment_id"),
	CONSTRAINT "settlement_line_flag" CHECK ("settlement_line"."flag" IN ('ok', 'amount_mismatch'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_request" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"branch_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "approval_request_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "approval_request_kind" CHECK ("approval_request"."kind" IN ('refund', 'discount')),
	CONSTRAINT "approval_request_status" CHECK ("approval_request"."status" IN ('pending', 'approved', 'declined', 'expired')),
	CONSTRAINT "approval_request_decision" CHECK (("approval_request"."status" IN ('approved', 'declined')) = ("approval_request"."decided_by" IS NOT NULL AND "approval_request"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"stores" integer NOT NULL,
	"terminals" integer NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"checkout_url" text,
	"reminders" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "invoice_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "invoice_reference_unique" UNIQUE("reference"),
	CONSTRAINT "invoice_org_id_period_start_unique" UNIQUE("org_id","period_start"),
	CONSTRAINT "invoice_status" CHECK ("invoice"."status" IN ('open', 'paid', 'void')),
	CONSTRAINT "invoice_amount" CHECK ("invoice"."amount" >= 0 AND "invoice"."amount" % 100 = 0),
	CONSTRAINT "invoice_paid" CHECK (("invoice"."status" = 'paid') = ("invoice"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_day" integer NOT NULL,
	"next_invoice_on" date NOT NULL,
	CONSTRAINT "subscription_org_id_unique" UNIQUE("org_id"),
	CONSTRAINT "subscription_status" CHECK ("subscription"."status" IN ('active', 'past_due', 'read_only')),
	CONSTRAINT "subscription_billing_day" CHECK ("subscription"."billing_day" BETWEEN 1 AND 28)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receipt_email" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sale_id" uuid NOT NULL,
	"email" text NOT NULL,
	"request_key" text NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "receipt_email_org_id_request_key_unique" UNIQUE("org_id","request_key")
);
--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "momo_provider" text DEFAULT 'paystack' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'paystack' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_org_id_payment_id_payment_org_id_id_fk" FOREIGN KEY ("org_id","payment_id") REFERENCES "public"."payment"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_org_id_refund_id_refund_org_id_id_fk" FOREIGN KEY ("org_id","refund_id") REFERENCES "public"."refund"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "settlement" ADD CONSTRAINT "settlement_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "settlement_line" ADD CONSTRAINT "settlement_line_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "settlement_line" ADD CONSTRAINT "settlement_line_org_id_settlement_id_settlement_org_id_id_fk" FOREIGN KEY ("org_id","settlement_id") REFERENCES "public"."settlement"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "settlement_line" ADD CONSTRAINT "settlement_line_org_id_payment_id_payment_org_id_id_fk" FOREIGN KEY ("org_id","payment_id") REFERENCES "public"."payment"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_org_id_device_id_device_org_id_id_fk" FOREIGN KEY ("org_id","device_id") REFERENCES "public"."device"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_org_id_requested_by_user_org_id_id_fk" FOREIGN KEY ("org_id","requested_by") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_org_id_decided_by_user_org_id_id_fk" FOREIGN KEY ("org_id","decided_by") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice" ADD CONSTRAINT "invoice_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "subscription" ADD CONSTRAINT "subscription_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "receipt_email" ADD CONSTRAINT "receipt_email_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "receipt_email" ADD CONSTRAINT "receipt_email_org_id_sale_id_sale_org_id_id_fk" FOREIGN KEY ("org_id","sale_id") REFERENCES "public"."sale"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_line_payment" ON "settlement_line" USING btree ("org_id","payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_request_status" ON "approval_request" USING btree ("org_id","status");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "org" ADD CONSTRAINT "org_momo_provider" CHECK ("org"."momo_provider" IN ('paystack', 'hubtel'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_provider" CHECK ("payment"."provider" IN ('paystack', 'hubtel'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
