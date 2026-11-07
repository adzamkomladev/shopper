-- Day 34: fulfilment. Order events, picks, adjustments and reviews; refunds may be several per payment (one per reason);
-- a fiscal document may come from an order adjustment. Replayable.
CREATE TABLE IF NOT EXISTS "online_order_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"actor_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "online_order_event_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "online_order_event_status" UNIQUE("org_id","order_id","status"),
	CONSTRAINT "online_order_event_status_value" CHECK ("online_order_event"."status" IN ('placed', 'expired', 'cancelled', 'paid', 'accepted', 'picking', 'ready', 'out_for_delivery', 'completed', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "online_order_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"before_gross" bigint NOT NULL,
	"after_gross" bigint NOT NULL,
	"refund_amount" bigint NOT NULL,
	"refund_id" uuid,
	"credit_note_number" text,
	"supplement_number" text,
	CONSTRAINT "online_order_adjustment_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "online_order_adjustment_order" UNIQUE("org_id","order_id"),
	CONSTRAINT "online_order_adjustment_sum" CHECK ("online_order_adjustment"."after_gross" + "online_order_adjustment"."refund_amount" = "online_order_adjustment"."before_gross")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "online_order_pick" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"picked_thousandths" integer NOT NULL,
	"substitute_product_id" uuid,
	"substitute_quantity_thousandths" integer,
	"substitute_gross" bigint,
	"substitute_payload" jsonb,
	"picker_id" uuid,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_order_pick_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "online_order_pick_line" UNIQUE("org_id","order_id","line_id"),
	CONSTRAINT "online_order_pick_quantity" CHECK ("online_order_pick"."picked_thousandths" >= 0),
	CONSTRAINT "online_order_pick_substitute" CHECK (("online_order_pick"."outcome" = 'substituted') = ("online_order_pick"."substitute_product_id" IS NOT NULL
        AND "online_order_pick"."substitute_quantity_thousandths" > 0 AND "online_order_pick"."substitute_gross" IS NOT NULL
        AND "online_order_pick"."substitute_payload" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_review" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"flag_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	CONSTRAINT "order_review_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "order_review_order" UNIQUE("org_id","order_id"),
	CONSTRAINT "order_review_rating" CHECK ("order_review"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "order_review_status" CHECK ("order_review"."status" IN ('submitted', 'flagged', 'published', 'rejected')),
	CONSTRAINT "order_review_published" CHECK (("order_review"."status" = 'published') = ("order_review"."published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "order_refund" DROP CONSTRAINT "order_refund_payment";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT "fiscal_doc_source";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT "fiscal_doc_kind";
--> statement-breakpoint
ALTER TABLE "order_refund" DROP CONSTRAINT "order_refund_reason";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD COLUMN IF NOT EXISTS "adjustment_credit_id" uuid;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD COLUMN IF NOT EXISTS "adjustment_invoice_id" uuid;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "ready_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "review_asked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "fulfilled_gross" bigint;
--> statement-breakpoint
ALTER TABLE "online_order_event" DROP CONSTRAINT IF EXISTS "online_order_event_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_event" ADD CONSTRAINT "online_order_event_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_event" DROP CONSTRAINT IF EXISTS "online_order_event_org_id_order_id_online_order_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_event" ADD CONSTRAINT "online_order_event_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" DROP CONSTRAINT IF EXISTS "online_order_adjustment_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" ADD CONSTRAINT "online_order_adjustment_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" DROP CONSTRAINT IF EXISTS "online_order_adjustment_org_id_order_id_online_order_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" ADD CONSTRAINT "online_order_adjustment_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" DROP CONSTRAINT IF EXISTS "online_order_adjustment_org_id_refund_id_order_refund_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_adjustment" ADD CONSTRAINT "online_order_adjustment_org_id_refund_id_order_refund_org_id_id_fk" FOREIGN KEY ("org_id","refund_id") REFERENCES "public"."order_refund"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_pick" DROP CONSTRAINT IF EXISTS "online_order_pick_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_pick" ADD CONSTRAINT "online_order_pick_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_pick" DROP CONSTRAINT IF EXISTS "online_order_pick_org_id_order_id_online_order_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_pick" ADD CONSTRAINT "online_order_pick_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_pick" DROP CONSTRAINT IF EXISTS "online_order_pick_org_id_line_id_online_order_line_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_pick" ADD CONSTRAINT "online_order_pick_org_id_line_id_online_order_line_org_id_id_fk" FOREIGN KEY ("org_id","line_id") REFERENCES "public"."online_order_line"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_order_pick" DROP CONSTRAINT IF EXISTS "online_order_pick_org_id_substitute_product_id_product_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "online_order_pick" ADD CONSTRAINT "online_order_pick_org_id_substitute_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","substitute_product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_review" DROP CONSTRAINT IF EXISTS "order_review_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "order_review" ADD CONSTRAINT "order_review_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_review" DROP CONSTRAINT IF EXISTS "order_review_org_id_order_id_online_order_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "order_review" ADD CONSTRAINT "order_review_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_org_id_adjustment_credit_id_online_order_adjustment_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_adjustment_credit_id_online_order_adjustment_org_id_id_fk" FOREIGN KEY ("org_id","adjustment_credit_id") REFERENCES "public"."online_order_adjustment"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_org_id_adjustment_invoice_id_online_order_adjustment_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_adjustment_invoice_id_online_order_adjustment_org_id_id_fk" FOREIGN KEY ("org_id","adjustment_invoice_id") REFERENCES "public"."online_order_adjustment"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_org_id_adjustment_credit_id_unique";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_adjustment_credit_id_unique" UNIQUE("org_id","adjustment_credit_id");
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_org_id_adjustment_invoice_id_unique";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_org_id_adjustment_invoice_id_unique" UNIQUE("org_id","adjustment_invoice_id");
--> statement-breakpoint
ALTER TABLE "order_refund" DROP CONSTRAINT IF EXISTS "order_refund_payment";
--> statement-breakpoint
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_payment" UNIQUE("org_id","order_payment_id","reason");
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_source";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_source" CHECK (num_nonnulls("fiscal_doc"."sale_id", "fiscal_doc"."refund_id", "fiscal_doc"."order_id", "fiscal_doc"."order_refund_id", "fiscal_doc"."adjustment_credit_id", "fiscal_doc"."adjustment_invoice_id") = 1);
--> statement-breakpoint
ALTER TABLE "fiscal_doc" DROP CONSTRAINT IF EXISTS "fiscal_doc_kind";
--> statement-breakpoint
ALTER TABLE "fiscal_doc" ADD CONSTRAINT "fiscal_doc_kind" CHECK (("fiscal_doc"."kind" = 'invoice') = ("fiscal_doc"."refund_id" IS NULL AND "fiscal_doc"."order_refund_id" IS NULL AND "fiscal_doc"."adjustment_credit_id" IS NULL));
--> statement-breakpoint
ALTER TABLE "order_refund" DROP CONSTRAINT IF EXISTS "order_refund_reason";
--> statement-breakpoint
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_reason" CHECK ("order_refund"."reason" IN ('late_payment', 'duplicate_payment', 'not_accepted', 'cancelled', 'declined', 'short_pick', 'not_fulfilled', 'uncollected'));
