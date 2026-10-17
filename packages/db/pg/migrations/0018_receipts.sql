ALTER TABLE asset DROP CONSTRAINT IF EXISTS asset_policy;
--> statement-breakpoint
ALTER TABLE asset ADD CONSTRAINT asset_policy CHECK (
  (purpose = 'catalogue_import' AND bucket = 'imports' AND expires_at IS NOT NULL) OR
  (purpose = 'sync_snapshot' AND bucket = 'snapshots' AND expires_at IS NULL) OR
  (purpose = 'sale_receipt' AND bucket = 'receipts' AND expires_at IS NULL));
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS receipt_asset_id uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_org_id_receipt_asset_id_asset_org_id_id_fk' AND conrelid = 'sale'::regclass) THEN
    ALTER TABLE sale ADD CONSTRAINT sale_org_id_receipt_asset_id_asset_org_id_id_fk
      FOREIGN KEY (org_id, receipt_asset_id) REFERENCES asset(org_id, id);
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_preserve_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Accepted sales are immutable'; END IF;
  IF OLD.store_sequence IS NULL AND NEW.store_sequence > 0 AND
     (to_jsonb(NEW) - 'store_sequence' - 'updated_at') IS NOT DISTINCT FROM
     (to_jsonb(OLD) - 'store_sequence' - 'updated_at') THEN
    NULL;
  ELSIF OLD.receipt_asset_id IS NULL AND NEW.receipt_asset_id IS NOT NULL AND
     (to_jsonb(NEW) - 'receipt_asset_id' - 'updated_at') IS NOT DISTINCT FROM
     (to_jsonb(OLD) - 'receipt_asset_id' - 'updated_at') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Only first sale sequence or receipt assignment is allowed';
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
