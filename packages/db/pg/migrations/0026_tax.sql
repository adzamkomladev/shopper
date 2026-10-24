ALTER TABLE org ADD COLUMN IF NOT EXISTS tin text;
--> statement-breakpoint
-- Orgs from before this migration taxed every sale, so the one-shot default keeps them registered (since
-- registeredSince in @shopper/tax); the default is dropped at once and new orgs get their date from provisioning.
ALTER TABLE org ADD COLUMN IF NOT EXISTS vat_registered_from date DEFAULT DATE '2000-01-01';
--> statement-breakpoint
ALTER TABLE org ALTER COLUMN vat_registered_from DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE org ADD COLUMN IF NOT EXISTS price_mode text NOT NULL DEFAULT 'inclusive';
--> statement-breakpoint
ALTER TABLE org DROP CONSTRAINT IF EXISTS org_price_mode;
--> statement-breakpoint
ALTER TABLE org ADD CONSTRAINT org_price_mode CHECK (price_mode IN ('inclusive', 'exclusive'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS vat_return (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  period text NOT NULL,
  input_vat bigint NOT NULL DEFAULT 0,
  input_nhil bigint NOT NULL DEFAULT 0,
  input_getfund bigint NOT NULL DEFAULT 0,
  CONSTRAINT vat_return_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT vat_return_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT vat_return_org_id_period_unique UNIQUE (org_id, period),
  CONSTRAINT vat_return_period CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT vat_return_input CHECK (input_vat >= 0 AND input_nhil >= 0 AND input_getfund >= 0)
);
--> statement-breakpoint
ALTER TABLE store_change DROP CONSTRAINT IF EXISTS store_change_entity;
--> statement-breakpoint
ALTER TABLE store_change ADD CONSTRAINT store_change_entity CHECK (entity IN ('product', 'price', 'tax-rule', 'barcode-mapping', 'customer', 'org-setting'));
--> statement-breakpoint
ALTER TABLE refund ADD COLUMN IF NOT EXISTS credit_note_number text;
--> statement-breakpoint
ALTER TABLE refund DROP CONSTRAINT IF EXISTS refund_credit_note_unique;
--> statement-breakpoint
ALTER TABLE refund ADD CONSTRAINT refund_credit_note_unique UNIQUE (org_id, credit_note_number);
