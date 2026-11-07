-- Day 33: online payments. order_payment is one attempt to pay an order; order_refund is money owed back; a paid
-- order keeps its own receipt, fiscal document (fiscal_doc.order_id) and stock movement. Replayable.
CREATE TABLE IF NOT EXISTS "order_payment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"method" text NOT NULL,
	"network" text,
	"phone" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"checkout_url" text,
	"failure_reason" text,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "order_payment_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "order_payment_amount" CHECK ("order_payment"."amount" > 0 AND "order_payment"."amount" % 100 = 0),
	CONSTRAINT "order_payment_method" CHECK ("order_payment"."method" IN ('card', 'momo')),
	CONSTRAINT "order_payment_provider" CHECK ("order_payment"."provider" IN ('paystack', 'hubtel')),
	CONSTRAINT "order_payment_network" CHECK (("order_payment"."method" = 'momo') = ("order_payment"."network" IS NOT NULL)),
	CONSTRAINT "order_payment_status" CHECK ("order_payment"."status" IN ('pending', 'otp', 'confirmed', 'failed', 'expired')),
	CONSTRAINT "order_payment_confirmed" CHECK (("order_payment"."status" = 'confirmed') = ("order_payment"."confirmed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_refund" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"failure_reason" text,
	CONSTRAINT "order_refund_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "order_refund_payment" UNIQUE("org_id","order_payment_id"),
	CONSTRAINT "order_refund_amount" CHECK ("order_refund"."amount" > 0 AND "order_refund"."amount" % 100 = 0),
	CONSTRAINT "order_refund_status" CHECK ("order_refund"."status" IN ('pending', 'requested', 'processed', 'failed', 'refund_due')),
	CONSTRAINT "order_refund_reason" CHECK ("order_refund"."reason" IN ('late_payment', 'duplicate_payment', 'not_accepted', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "stock_movement" DROP CONSTRAINT IF EXISTS "stock_movement_return";
--> statement-breakpoint
ALTER TABLE "stock_movement" DROP CONSTRAINT IF EXISTS "stock_movement_sale";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_source";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_kind";
--> statement-breakpoint
ALTER TABLE "journal_entry" DROP CONSTRAINT IF EXISTS "journal_entry_source_kind";
--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "order_id" uuid;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD COLUMN IF NOT EXISTS "order_id" uuid;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD COLUMN IF NOT EXISTS "order_refund_id" uuid;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "receipt_number" text;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "receipt" jsonb;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "receipt_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "sms_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "email_sent_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_org_id_order_payment_id_order_payment_org_id_id_fk" FOREIGN KEY ("org_id","order_payment_id") REFERENCES "public"."order_payment"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_payment_open" ON "order_payment" USING btree ("org_id","order_id") WHERE "order_payment"."status" IN ('pending', 'otp');
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_order_refund_id_order_refund_org_id_id_fk" FOREIGN KEY ("org_id","order_refund_id") REFERENCES "public"."order_refund"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_receipt_asset_id_asset_org_id_id_fk" FOREIGN KEY ("org_id","receipt_asset_id") REFERENCES "public"."asset"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movement_order" ON "stock_movement" USING btree ("org_id","order_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_order_id_unique" UNIQUE("org_id","order_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_order_refund_id_unique" UNIQUE("org_id","order_refund_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_receipt" UNIQUE("org_id","receipt_number");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_return" CHECK ("stock_movement"."reason" <> 'return' OR (("stock_movement"."refund_id" IS NOT NULL OR "stock_movement"."order_id" IS NOT NULL) AND "stock_movement"."quantity_thousandths" > 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sale" CHECK ("stock_movement"."reason" <> 'sale' OR (("stock_movement"."sale_id" IS NOT NULL OR "stock_movement"."order_id" IS NOT NULL) AND "stock_movement"."quantity_thousandths" < 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_source" CHECK (num_nonnulls("fiscal_doc"."sale_id", "fiscal_doc"."refund_id", "fiscal_doc"."order_id", "fiscal_doc"."order_refund_id") = 1);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_kind" CHECK (("fiscal_doc"."kind" = 'invoice') = ("fiscal_doc"."refund_id" IS NULL AND "fiscal_doc"."order_refund_id" IS NULL));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_source_kind" CHECK ("journal_entry"."source" IN ('sale', 'refund', 'order', 'credit', 'loyalty', 'shift', 'stock', 'settlement', 'manual', 'reversal'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_receipt_issued" CHECK (("online_order"."receipt" IS NULL) = ("online_order"."receipt_number" IS NULL));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
