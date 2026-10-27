-- Day 22: store trading hours, the store-day record, the report rollups and the settled value of returned points.
-- Every statement can be replayed.
CREATE TABLE IF NOT EXISTS "report_product" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"day" date NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" bigint NOT NULL,
	"gross" bigint NOT NULL,
	"discount" bigint NOT NULL,
	"tax" bigint NOT NULL,
	"net" bigint NOT NULL,
	"cost" bigint NOT NULL,
	"uncosted" bigint NOT NULL,
	"refund_quantity" bigint NOT NULL,
	"refund_gross" bigint NOT NULL,
	"refund_net" bigint NOT NULL,
	"refund_cost" bigint NOT NULL,
	CONSTRAINT "report_product_org_id_store_id_day_branch_id_product_id_unique" UNIQUE("org_id","store_id","day","branch_id","product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_sales" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"day" date NOT NULL,
	"hour" smallint NOT NULL,
	"cashier_id" uuid NOT NULL,
	"sales" integer NOT NULL,
	"items" bigint NOT NULL,
	"gross" bigint NOT NULL,
	"discount" bigint NOT NULL,
	"tax" bigint NOT NULL,
	"vat" bigint NOT NULL,
	"nhil" bigint NOT NULL,
	"getfund" bigint NOT NULL,
	"covid" bigint NOT NULL,
	"net" bigint NOT NULL,
	"rounding" bigint NOT NULL,
	"refunds" integer NOT NULL,
	"refund_gross" bigint NOT NULL,
	"refund_tax" bigint NOT NULL,
	"refund_vat" bigint NOT NULL,
	"refund_nhil" bigint NOT NULL,
	"refund_getfund" bigint NOT NULL,
	"refund_covid" bigint NOT NULL,
	"refund_net" bigint NOT NULL,
	"refund_rounding" bigint NOT NULL,
	CONSTRAINT "report_sales_org_id_store_id_day_branch_id_hour_cashier_id_unique" UNIQUE("org_id","store_id","day","branch_id","hour","cashier_id"),
	CONSTRAINT "report_sales_hour" CHECK ("report_sales"."hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_tender" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer NOT NULL,
	"amount" bigint NOT NULL,
	"refunded" bigint NOT NULL,
	CONSTRAINT "report_tender_org_id_store_id_day_branch_id_kind_unique" UNIQUE("org_id","store_id","day","branch_id","kind")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_day" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"rolled_at" timestamp with time zone,
	"summary" jsonb,
	CONSTRAINT "store_day_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "store_day_org_id_store_id_day_unique" UNIQUE("org_id","store_id","day"),
	CONSTRAINT "store_day_status" CHECK ("store_day"."status" IN ('pending', 'open', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "refund" DROP CONSTRAINT IF EXISTS "refund_account";
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "opens_at" time DEFAULT '07:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "closes_at" time DEFAULT '21:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN IF NOT EXISTS "points_value" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_product" ADD CONSTRAINT "report_product_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_product" ADD CONSTRAINT "report_product_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_product" ADD CONSTRAINT "report_product_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_sales" ADD CONSTRAINT "report_sales_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_sales" ADD CONSTRAINT "report_sales_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_sales" ADD CONSTRAINT "report_sales_org_id_cashier_id_user_org_id_id_fk" FOREIGN KEY ("org_id","cashier_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_tender" ADD CONSTRAINT "report_tender_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_tender" ADD CONSTRAINT "report_tender_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_day" ADD CONSTRAINT "store_day_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_day" ADD CONSTRAINT "store_day_org_id_store_id_store_org_id_id_fk" FOREIGN KEY ("org_id","store_id") REFERENCES "public"."store"("org_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_product_day" ON "report_product" USING btree ("org_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_sales_day" ON "report_sales" USING btree ("org_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_tender_day" ON "report_tender" USING btree ("org_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_day_rolled" ON "store_day" USING btree ("org_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_occurred" ON "sale" USING btree ("org_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_occurred" ON "refund" USING btree ("org_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_line_sale" ON "sale_line" USING btree ("org_id","sale_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store" ADD CONSTRAINT "store_hours" CHECK ("store"."closes_at" > "store"."opens_at");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "refund" ADD CONSTRAINT "refund_account" CHECK ("refund"."account_credit" >= 0 AND "refund"."points_returned" >= 0 AND "refund"."points_value" >= 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
