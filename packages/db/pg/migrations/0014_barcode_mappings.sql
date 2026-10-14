CREATE TABLE IF NOT EXISTS barcode_mapping (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prefix integer NOT NULL,
  product_start integer NOT NULL,
  product_length integer NOT NULL,
  value_start integer NOT NULL,
  value_length integer NOT NULL,
  kind text NOT NULL,
  unit text,
  decimals integer NOT NULL,
  CONSTRAINT barcode_mapping_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT barcode_mapping_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT barcode_mapping_org_id_prefix_unique UNIQUE (org_id, prefix),
  CONSTRAINT barcode_mapping_prefix CHECK (prefix BETWEEN 20 AND 29),
  CONSTRAINT barcode_mapping_slices CHECK (product_start >= 2 AND product_length >= 1 AND product_start + product_length <= 12 AND value_start >= 2 AND value_length >= 1 AND value_start + value_length <= 12 AND (product_start + product_length <= value_start OR value_start + value_length <= product_start)),
  CONSTRAINT barcode_mapping_kind CHECK ((kind = 'weight' AND unit IN ('g', 'kg')) OR (kind = 'price' AND unit IS NULL)),
  CONSTRAINT barcode_mapping_decimals CHECK (decimals BETWEEN 0 AND 4)
);
--> statement-breakpoint
ALTER TABLE store_change DROP CONSTRAINT IF EXISTS store_change_entity;
--> statement-breakpoint
ALTER TABLE store_change ADD CONSTRAINT store_change_entity CHECK (entity IN ('product', 'price', 'tax-rule', 'barcode-mapping'));
