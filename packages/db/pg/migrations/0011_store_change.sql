CREATE TABLE IF NOT EXISTS "store_change" (
	"org_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"op" text NOT NULL,
	"v" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_change_org_id_store_id_seq_pk" PRIMARY KEY("org_id","store_id","seq"),
	CONSTRAINT "store_change_entity" CHECK ("store_change"."entity" IN ('product', 'price', 'tax-rule')),
	CONSTRAINT "store_change_op" CHECK ("store_change"."op" IN ('upsert', 'delete'))
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_change'::regclass AND conname = 'store_change_org_id_org_id_fk') THEN
    ALTER TABLE "store_change" ADD CONSTRAINT "store_change_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_change'::regclass AND conname = 'store_change_org_id_store_id_store_org_id_id_fk') THEN
    ALTER TABLE "store_change" ADD CONSTRAINT "store_change_org_id_store_id_store_org_id_id_fk" FOREIGN KEY ("org_id","store_id") REFERENCES "public"."store"("org_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'store_change'::regclass AND tgname = 'store_change_immutable') THEN
    CREATE TRIGGER store_change_immutable BEFORE UPDATE OR DELETE ON store_change
    FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
  END IF;
END $$;
