-- Day 32: online orders. A branch says how it hands orders over (branch_fulfilment); an order and its lines keep
-- the tax snapshot and price version the customer saw; stock_hold keeps the stock aside until the hold expires.
-- Replayable.
CREATE TABLE IF NOT EXISTS "online_order" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text DEFAULT 'online' NOT NULL,
	"status" text DEFAULT 'placed' NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"inbox_cursor" bigint NOT NULL,
	"fulfilment" text NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"delivery_address" jsonb,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"shop_account_id" uuid,
	"view_token_digest" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"base" bigint NOT NULL,
	"vat" bigint NOT NULL,
	"nhil" bigint NOT NULL,
	"getfund" bigint NOT NULL,
	"covid" bigint NOT NULL,
	"gross" bigint NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_order_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "online_order_cursor" UNIQUE("org_id","store_id","inbox_cursor"),
	CONSTRAINT "online_order_idempotency" UNIQUE("org_id","idempotency_key"),
	CONSTRAINT "online_order_phone_format" CHECK ("online_order"."customer_phone" ~ '^0[0-9]{9}$'),
	CONSTRAINT "online_order_slot_order" CHECK ("online_order"."slot_end" > "online_order"."slot_start"),
	CONSTRAINT "online_order_address" CHECK (("online_order"."fulfilment" = 'delivery') = ("online_order"."delivery_address" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "online_order_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"product_id" uuid,
	"price_id" uuid,
	"tax_rule_id" uuid NOT NULL,
	"quantity_thousandths" integer NOT NULL,
	"gross" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "online_order_line_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "online_order_line_org_id_order_id_position_unique" UNIQUE("org_id","order_id","position"),
	CONSTRAINT "online_order_line_kind" CHECK (("online_order_line"."kind" = 'product') = ("online_order_line"."product_id" IS NOT NULL AND "online_order_line"."price_id" IS NOT NULL)),
	CONSTRAINT "online_order_line_quantity" CHECK ("online_order_line"."quantity_thousandths" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branch_fulfilment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"branch_id" uuid NOT NULL,
	"pickup" boolean DEFAULT true NOT NULL,
	"delivery" boolean DEFAULT false NOT NULL,
	"delivery_fee" bigint DEFAULT 0 NOT NULL,
	"opens" time DEFAULT '08:00' NOT NULL,
	"closes" time DEFAULT '20:00' NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"slot_capacity" integer DEFAULT 10 NOT NULL,
	"lead_minutes" integer DEFAULT 60 NOT NULL,
	CONSTRAINT "branch_fulfilment_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "branch_fulfilment_branch" UNIQUE("org_id","branch_id"),
	CONSTRAINT "branch_fulfilment_hours" CHECK ("branch_fulfilment"."closes" > "branch_fulfilment"."opens"),
	CONSTRAINT "branch_fulfilment_slot" CHECK ("branch_fulfilment"."slot_minutes" IN (30, 60, 120)),
	CONSTRAINT "branch_fulfilment_capacity" CHECK ("branch_fulfilment"."slot_capacity" BETWEEN 1 AND 500),
	CONSTRAINT "branch_fulfilment_lead" CHECK ("branch_fulfilment"."lead_minutes" BETWEEN 0 AND 2880),
	CONSTRAINT "branch_fulfilment_fee" CHECK ("branch_fulfilment"."delivery_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_hold" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"branch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity_thousandths" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"release_reason" text,
	CONSTRAINT "stock_hold_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "stock_hold_line" UNIQUE("org_id","order_id","product_id"),
	CONSTRAINT "stock_hold_quantity" CHECK ("stock_hold"."quantity_thousandths" > 0),
	CONSTRAINT "stock_hold_release" CHECK (("stock_hold"."released_at" IS NULL) = ("stock_hold"."release_reason" IS NULL))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_store_id_store_org_id_id_fk" FOREIGN KEY ("org_id","store_id") REFERENCES "public"."store"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order" ADD CONSTRAINT "online_order_org_id_shop_account_id_shop_account_org_id_id_fk" FOREIGN KEY ("org_id","shop_account_id") REFERENCES "public"."shop_account"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order_line" ADD CONSTRAINT "online_order_line_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order_line" ADD CONSTRAINT "online_order_line_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order_line" ADD CONSTRAINT "online_order_line_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order_line" ADD CONSTRAINT "online_order_line_org_id_price_id_price_org_id_id_fk" FOREIGN KEY ("org_id","price_id") REFERENCES "public"."price"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_order_line" ADD CONSTRAINT "online_order_line_org_id_tax_rule_id_tax_rule_org_id_id_fk" FOREIGN KEY ("org_id","tax_rule_id") REFERENCES "public"."tax_rule"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "branch_fulfilment" ADD CONSTRAINT "branch_fulfilment_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "branch_fulfilment" ADD CONSTRAINT "branch_fulfilment_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_hold" ADD CONSTRAINT "stock_hold_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_hold" ADD CONSTRAINT "stock_hold_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_hold" ADD CONSTRAINT "stock_hold_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_hold" ADD CONSTRAINT "stock_hold_org_id_order_id_online_order_org_id_id_fk" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."online_order"("org_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "online_order_slot" ON "online_order" USING btree ("org_id","branch_id","slot_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_hold_active" ON "stock_hold" USING btree ("org_id","branch_id","product_id") WHERE "stock_hold"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_hold_expiry" ON "stock_hold" USING btree ("org_id","branch_id","expires_at") WHERE "stock_hold"."released_at" IS NULL;