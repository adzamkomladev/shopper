-- Day 49 (v1.5): what a relay org's box says each branch can still sell online, written only by its publish (relay
-- lock), and the box's shop-wide buffer kept back from the online store. Replayable.
CREATE TABLE IF NOT EXISTS "online_availability" (
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_thousandths" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_availability_org_id_branch_id_product_id_pk" PRIMARY KEY("org_id","branch_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "online_buffer" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "online_availability" DROP CONSTRAINT IF EXISTS "online_availability_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "online_availability" ADD CONSTRAINT "online_availability_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_availability" DROP CONSTRAINT IF EXISTS "online_availability_org_id_branch_id_branch_org_id_id_fk";--> statement-breakpoint
ALTER TABLE "online_availability" ADD CONSTRAINT "online_availability_org_id_branch_id_branch_org_id_id_fk" FOREIGN KEY ("org_id","branch_id") REFERENCES "public"."branch"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_availability" DROP CONSTRAINT IF EXISTS "online_availability_org_id_product_id_product_org_id_id_fk";--> statement-breakpoint
ALTER TABLE "online_availability" ADD CONSTRAINT "online_availability_org_id_product_id_product_org_id_id_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."product"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON online_availability FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();
