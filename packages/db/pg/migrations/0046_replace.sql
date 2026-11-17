-- A box moving back into the cloud replaces the cloud's archived copy of its shop (Day 44). The import deletes that
-- org's rows in its own transaction with `shopper.replace` set (SET LOCAL) to the org's id; the history guards let
-- exactly that org's deletes through. Updates are still refused, and so is every other org's row.
CREATE OR REPLACE FUNCTION shopper_reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND to_jsonb(OLD)->>'org_id' = current_setting('shopper.replace', true) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Shopper history is append-only';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION shopper_preserve_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.org_id::text = current_setting('shopper.replace', true) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Accepted sales are immutable';
  END IF;
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
