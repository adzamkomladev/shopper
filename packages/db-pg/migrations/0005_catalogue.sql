DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_class_org_id_id_unique') THEN
    ALTER TABLE "tax_class" ADD CONSTRAINT "tax_class_org_id_id_unique" UNIQUE("org_id","id");
  END IF;
END;
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	CONSTRAINT "category_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" uuid NOT NULL,
	"branch_id" uuid,
	"amount" bigint NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "price_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "price_amount_positive" CHECK ("price"."amount" > 0),
	CONSTRAINT "price_window" CHECK ("price"."valid_to" IS NULL OR "price"."valid_to" > "price"."valid_from")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"supplier_id" uuid,
	"tax_class_id" uuid NOT NULL,
	"base_unit" text NOT NULL,
	"online_visible" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "product_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "product_org_id_sku_unique" UNIQUE("org_id","sku"),
	CONSTRAINT "product_base_unit" CHECK ("product"."base_unit" IN ('each', 'kg', 'g', 'l', 'ml'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_barcode" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" uuid NOT NULL,
	"code" text NOT NULL,
	"quantity_thousandths" integer DEFAULT 1000 NOT NULL,
	CONSTRAINT "product_barcode_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "product_barcode_org_id_code_unique" UNIQUE("org_id","code"),
	CONSTRAINT "product_barcode_quantity" CHECK ("product_barcode"."quantity_thousandths" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_import" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"rows_total" integer NOT NULL,
	"rows_ok" integer NOT NULL,
	"rows_failed" integer NOT NULL,
	"report" jsonb NOT NULL,
	"price_valid_from" timestamp with time zone NOT NULL,
	"actor_id" uuid,
	CONSTRAINT "product_import_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"tin" text,
	CONSTRAINT "supplier_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_org_id_org_id_fk') THEN
    ALTER TABLE "category" ADD CONSTRAINT "category_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_org_id_parent_id_category_org_id_id_fk') THEN
    ALTER TABLE "category" ADD CONSTRAINT "category_org_id_parent_id_category_org_id_id_fk" FOREIGN KEY ("org_id","parent_id") REFERENCES "public"."category"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_org_id_org_id_fk') THEN
    ALTER TABLE "price" ADD CONSTRAINT "price_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_org_id_product_id_product_org_id_id_fk') THEN
    ALTER TABLE "price" ADD CONSTRAINT "price_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_org_id_branch_id_branch_org_id_id_fk') THEN
    ALTER TABLE "price" ADD CONSTRAINT "price_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_org_id_org_id_fk') THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_org_id_category_id_category_org_id_id_fk') THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_org_id_category_id_category_org_id_id_fk" FOREIGN KEY ("org_id","category_id") REFERENCES "public"."category"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_org_id_supplier_id_supplier_org_id_id_fk') THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_org_id_supplier_id_supplier_org_id_id_fk" FOREIGN KEY ("org_id","supplier_id") REFERENCES "public"."supplier"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_org_id_tax_class_id_tax_class_org_id_id_fk') THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_org_id_tax_class_id_tax_class_org_id_id_fk" FOREIGN KEY ("org_id","tax_class_id") REFERENCES "public"."tax_class"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_barcode_org_id_org_id_fk') THEN
    ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_barcode_org_id_product_id_product_org_id_id_fk') THEN
    ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_import_org_id_org_id_fk') THEN
    ALTER TABLE "product_import" ADD CONSTRAINT "product_import_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_import_org_id_actor_id_user_org_id_id_fk') THEN
    ALTER TABLE "product_import" ADD CONSTRAINT "product_import_org_id_actor_id_user_org_id_id_fk" FOREIGN KEY ("org_id","actor_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_org_id_org_id_fk') THEN
    ALTER TABLE "supplier" ADD CONSTRAINT "supplier_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "category_org_name_parent" ON "category" USING btree ("org_id",lower("name"),coalesce("parent_id", "org_id"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_org_id_product_id_branch_id_valid_from_index" ON "price" USING btree ("org_id","product_id","branch_id","valid_from" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_barcode_org_id_product_id_index" ON "product_barcode" USING btree ("org_id","product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_org_name" ON "supplier" USING btree ("org_id",lower("name"));
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['category', 'supplier', 'product', 'product_barcode', 'price', 'product_import'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'touch_updated_at' || '_' || table_name
    ) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION shopper_touch_updated_at()', 'touch_updated_at' || '_' || table_name, table_name);
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER price_append_only BEFORE UPDATE OR DELETE ON price
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER price_no_truncate BEFORE TRUNCATE ON price
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
