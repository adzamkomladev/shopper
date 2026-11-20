-- Day 51 (v1.5): customers of an on-prem shop. A box records which customers agreed to see receipts and points
-- online and links relayed orders to the in-store customer; a relay org keeps the copy its box publishes. Replayable.
CREATE TABLE IF NOT EXISTS "relay_customer" (
	"org_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"phone" text NOT NULL,
	"points" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relay_customer_org_id_id_pk" PRIMARY KEY("org_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_receipt" (
	"org_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"receipt_number" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"total" bigint,
	"status" text NOT NULL,
	"branch_name" text NOT NULL,
	"receipt" jsonb,
	CONSTRAINT "relay_receipt_org_id_id_pk" PRIMARY KEY("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "online_shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "relay_customer" DROP CONSTRAINT IF EXISTS "relay_customer_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "relay_customer" ADD CONSTRAINT "relay_customer_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_receipt" DROP CONSTRAINT IF EXISTS "relay_receipt_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "relay_receipt" ADD CONSTRAINT "relay_receipt_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_receipt" DROP CONSTRAINT IF EXISTS "relay_receipt_org_id_customer_id_relay_customer_org_id_id_fk";--> statement-breakpoint
ALTER TABLE "relay_receipt" ADD CONSTRAINT "relay_receipt_org_id_customer_id_relay_customer_org_id_id_fk" FOREIGN KEY ("org_id","customer_id") REFERENCES "public"."relay_customer"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_customer_phone" ON "relay_customer" USING btree ("org_id","phone");--> statement-breakpoint
ALTER TABLE "online_order" DROP CONSTRAINT IF EXISTS "online_order_org_id_customer_id_customer_org_id_id_fk";--> statement-breakpoint
ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_customer_id_customer_org_id_id_fk" FOREIGN KEY ("org_id","customer_id") REFERENCES "public"."customer"("org_id","id") ON DELETE no action ON UPDATE no action;