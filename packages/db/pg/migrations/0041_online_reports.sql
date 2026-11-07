-- Day 35: online orders in the reports. Each item an online order sells or gives back gets a report line, and an online
-- sale has no cashier, so its report_sales rows hold a null one (still one row per grain). Replayable.
CREATE TABLE IF NOT EXISTS "order_report_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"product_id" uuid,
	"tender" text NOT NULL,
	"tax" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_report_line_source" CHECK ("order_report_line"."source" IN ('order', 'adjustment', 'refund')),
	CONSTRAINT "order_report_line_kind" CHECK ("order_report_line"."kind" IN ('sale', 'refund')),
	CONSTRAINT "order_report_line_tender" CHECK ("order_report_line"."tender" IN ('card', 'momo'))
);
--> statement-breakpoint
ALTER TABLE "report_sales" DROP CONSTRAINT IF EXISTS "report_sales_org_id_store_id_day_branch_id_hour_cashier_id_unique";
--> statement-breakpoint
ALTER TABLE "report_sales" ALTER COLUMN "cashier_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_report_line" DROP CONSTRAINT IF EXISTS "order_report_line_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "order_report_line" ADD CONSTRAINT "order_report_line_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_report_line" DROP CONSTRAINT IF EXISTS "order_report_line_org_id_order_id_online_order_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "order_report_line" ADD CONSTRAINT "order_report_line_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_report_line" DROP CONSTRAINT IF EXISTS "order_report_line_org_id_branch_id_branch_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "order_report_line" ADD CONSTRAINT "order_report_line_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_report_line" DROP CONSTRAINT IF EXISTS "order_report_line_org_id_product_id_product_org_id_id_fk";
--> statement-breakpoint
ALTER TABLE "order_report_line" ADD CONSTRAINT "order_report_line_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_report_line_day" ON "order_report_line" USING btree ("org_id","store_id","occurred_at");
--> statement-breakpoint
ALTER TABLE "report_sales" DROP CONSTRAINT IF EXISTS "report_sales_org_id_store_id_day_branch_id_hour_cashier_id_unique";
--> statement-breakpoint
ALTER TABLE "report_sales" ADD CONSTRAINT "report_sales_org_id_store_id_day_branch_id_hour_cashier_id_unique" UNIQUE NULLS NOT DISTINCT("org_id","store_id","day","branch_id","hour","cashier_id");
