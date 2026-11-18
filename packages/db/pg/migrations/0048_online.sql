-- Day 47 (v1.5): the box's Online Orders switch, per-category online visibility and what the Publisher has sent its
-- relay org. Replayable.
CREATE TABLE IF NOT EXISTS "relay_published" (
	"org_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relay_published_org_id_entity_entity_id_pk" PRIMARY KEY("org_id","entity","entity_id")
);
--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "online_orders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "relay_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "relay_error" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "online_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_published" DROP CONSTRAINT IF EXISTS "relay_published_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "relay_published" ADD CONSTRAINT "relay_published_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A product is online when it, its category and that category's department are all visible (categories nest once).
CREATE OR REPLACE VIEW catalogue_public AS
SELECT p.org_id, p.id AS product_id, p.sku, p.name, p.category_id, p.base_unit, p.image_asset_id
FROM product p
LEFT JOIN category c ON c.org_id = p.org_id AND c.id = p.category_id
LEFT JOIN category d ON d.org_id = c.org_id AND d.id = c.parent_id
WHERE p.online_visible AND p.archived_at IS NULL
  AND coalesce(c.online_visible, true) AND coalesce(d.online_visible, true);
