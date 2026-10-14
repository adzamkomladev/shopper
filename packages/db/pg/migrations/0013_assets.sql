CREATE TABLE IF NOT EXISTS asset (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL,
  visibility text NOT NULL,
  bucket text NOT NULL,
  key text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  expires_at timestamptz,
  actor_id uuid,
  CONSTRAINT asset_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT asset_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT asset_org_id_key_unique UNIQUE (org_id, key),
  CONSTRAINT asset_org_id_actor_id_user_org_id_id_fk FOREIGN KEY (org_id, actor_id) REFERENCES "user"(org_id, id),
  CONSTRAINT asset_private CHECK (visibility = 'private'),
  CONSTRAINT asset_size CHECK (size_bytes >= 0),
  CONSTRAINT asset_sha256 CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT asset_policy CHECK ((purpose = 'catalogue_import' AND bucket = 'imports' AND expires_at IS NOT NULL) OR
    (purpose = 'sync_snapshot' AND bucket = 'snapshots' AND expires_at IS NULL))
);
--> statement-breakpoint
ALTER TABLE product_import ADD COLUMN IF NOT EXISTS asset_id uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_import_asset' AND conrelid = 'product_import'::regclass) THEN
    ALTER TABLE product_import ADD CONSTRAINT product_import_asset UNIQUE (org_id, asset_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_import_org_id_asset_id_asset_org_id_id_fk' AND conrelid = 'product_import'::regclass) THEN
    ALTER TABLE product_import ADD CONSTRAINT product_import_org_id_asset_id_asset_org_id_id_fk
      FOREIGN KEY (org_id, asset_id) REFERENCES asset(org_id, id);
  END IF;
END $$;
