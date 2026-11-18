-- Day 46 (v1.5): a box enrolled with its relay org, the signatures it has used, and the relay org's catalogue lock.
-- Replayable.
CREATE TABLE IF NOT EXISTS "relay_box" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"licence_id" uuid NOT NULL,
	"machine" text NOT NULL,
	"online_orders" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "relay_box_licence_id_unique" UNIQUE("licence_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_nonce" (
	"org_id" uuid NOT NULL,
	"licence_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relay_nonce_licence_id_digest_pk" PRIMARY KEY("licence_id","digest")
);
--> statement-breakpoint
ALTER TABLE "relay_box" DROP CONSTRAINT IF EXISTS "relay_box_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "relay_box" ADD CONSTRAINT "relay_box_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_nonce" DROP CONSTRAINT IF EXISTS "relay_nonce_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "relay_nonce" ADD CONSTRAINT "relay_nonce_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A relay org's catalogue is the box's projection (v1.5): only the relay publish command, which sets `shopper.relay`
-- (SET LOCAL) to the org's id, may write it. Every other path, the cloud back office included, is refused here.
CREATE OR REPLACE FUNCTION shopper_relay_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_org uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END;
BEGIN
  IF row_org::text IS DISTINCT FROM current_setting('shopper.relay', true)
     AND EXISTS (SELECT 1 FROM org WHERE id = row_org AND mode = 'relay') THEN
    RAISE EXCEPTION 'A relay org''s catalogue is written only by its box' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON tax_class FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON category FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON product FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON product_barcode FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON price FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();
