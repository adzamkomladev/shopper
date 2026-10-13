DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tax_rule'::regclass AND conname = 'tax_rule_org_id_id_unique') THEN
    ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_org_id_id_unique" UNIQUE("org_id","id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.cashier_session'::regclass AND conname = 'cashier_session_org_id_id_unique') THEN
    ALTER TABLE "cashier_session" ADD CONSTRAINT "cashier_session_org_id_id_unique" UNIQUE("org_id","id");
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"app_version" text NOT NULL,
	"event_version" bigint DEFAULT 1 NOT NULL,
	"device_time" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"store_sequence" bigint,
	CONSTRAINT "sale_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "sale_device_id_local_id_unique" UNIQUE("device_id","local_id"),
	CONSTRAINT "sale_org_id_store_id_store_sequence_unique" UNIQUE("org_id","store_id","store_sequence"),
	CONSTRAINT "sale_sequence_positive" CHECK ("sale"."store_sequence" IS NULL OR "sale"."store_sequence" > 0),
	CONSTRAINT "sale_event_version_positive" CHECK ("sale"."event_version" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	"tax_rule_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "sale_line_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "cashier_session" ADD COLUMN IF NOT EXISTS "issued_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "cashier_session" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "cashier_session" ADD COLUMN IF NOT EXISTS "role_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_org_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_device_id_device_org_id_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_device_id_device_org_id_id_fk" FOREIGN KEY ("org_id","device_id") REFERENCES "public"."device"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_store_id_store_org_id_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_store_id_store_org_id_id_fk" FOREIGN KEY ("org_id","store_id") REFERENCES "public"."store"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_branch_id_branch_org_id_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_cashier_id_user_org_id_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_cashier_id_user_org_id_id_fk" FOREIGN KEY ("org_id","cashier_id") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale'::regclass AND conname = 'sale_org_id_session_id_cashier_session_org_id_id_fk') THEN
    ALTER TABLE "sale" ADD CONSTRAINT "sale_org_id_session_id_cashier_session_org_id_id_fk" FOREIGN KEY ("org_id","session_id") REFERENCES "public"."cashier_session"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale_line'::regclass AND conname = 'sale_line_org_id_org_id_fk') THEN
    ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale_line'::regclass AND conname = 'sale_line_org_id_sale_id_sale_org_id_id_fk') THEN
    ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_org_id_sale_id_sale_org_id_id_fk" FOREIGN KEY ("org_id","sale_id") REFERENCES "public"."sale"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale_line'::regclass AND conname = 'sale_line_org_id_product_id_product_org_id_id_fk') THEN
    ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale_line'::regclass AND conname = 'sale_line_org_id_price_id_price_org_id_id_fk') THEN
    ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_org_id_price_id_price_org_id_id_fk" FOREIGN KEY ("org_id","price_id") REFERENCES "public"."price"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sale_line'::regclass AND conname = 'sale_line_org_id_tax_rule_id_tax_rule_org_id_id_fk') THEN
    ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_org_id_tax_rule_id_tax_rule_org_id_id_fk" FOREIGN KEY ("org_id","tax_rule_id") REFERENCES "public"."tax_rule"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_preserve_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Accepted sales are immutable'; END IF;
  IF (to_jsonb(NEW) - 'store_sequence' - 'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'store_sequence' - 'updated_at') OR
     OLD.store_sequence IS NOT NULL OR NEW.store_sequence IS NULL OR NEW.store_sequence <= 0 THEN
    RAISE EXCEPTION 'Only first sale sequence assignment is allowed';
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'sale'::regclass AND tgname = 'sale_immutable') THEN
    CREATE TRIGGER sale_immutable BEFORE UPDATE OR DELETE ON sale
    FOR EACH ROW EXECUTE FUNCTION shopper_preserve_sale();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'sale_line'::regclass AND tgname = 'sale_line_immutable') THEN
    CREATE TRIGGER sale_line_immutable BEFORE UPDATE OR DELETE ON sale_line
    FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
  END IF;
END $$;
