CREATE TABLE IF NOT EXISTS fiscal_archive (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL,
  hour timestamptz NOT NULL,
  key text NOT NULL,
  doc_count integer NOT NULL,
  sha256 text NOT NULL,
  bytes integer NOT NULL,
  CONSTRAINT fiscal_archive_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT fiscal_archive_org_id_store_id_store_org_id_id_fk FOREIGN KEY (org_id, store_id) REFERENCES store(org_id, id),
  CONSTRAINT fiscal_archive_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT fiscal_archive_org_id_store_id_hour_unique UNIQUE (org_id, store_id, hour)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS fiscal_doc (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  kind text NOT NULL,
  sale_id uuid,
  refund_id uuid,
  invoice_number text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sdc_id text,
  sdc_counter bigint,
  signature text,
  qr text,
  signed_at timestamptz,
  rejection_code text,
  rejection_message text,
  accepted_at timestamptz,
  archive_id uuid,
  CONSTRAINT fiscal_doc_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT fiscal_doc_org_id_store_id_store_org_id_id_fk FOREIGN KEY (org_id, store_id) REFERENCES store(org_id, id),
  CONSTRAINT fiscal_doc_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT fiscal_doc_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT fiscal_doc_org_id_refund_id_refund_org_id_id_fk FOREIGN KEY (org_id, refund_id) REFERENCES refund(org_id, id),
  CONSTRAINT fiscal_doc_org_id_archive_id_fiscal_archive_org_id_id_fk FOREIGN KEY (org_id, archive_id) REFERENCES fiscal_archive(org_id, id),
  CONSTRAINT fiscal_doc_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT fiscal_doc_org_id_sale_id_unique UNIQUE (org_id, sale_id),
  CONSTRAINT fiscal_doc_org_id_refund_id_unique UNIQUE (org_id, refund_id),
  CONSTRAINT fiscal_doc_status CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'dead')),
  CONSTRAINT fiscal_doc_kind_value CHECK (kind IN ('invoice', 'credit_note')),
  CONSTRAINT fiscal_doc_source CHECK ((sale_id IS NULL) <> (refund_id IS NULL)),
  CONSTRAINT fiscal_doc_kind CHECK ((kind = 'invoice') = (sale_id IS NOT NULL)),
  CONSTRAINT fiscal_doc_accepted CHECK (status <> 'accepted' OR (signature IS NOT NULL AND accepted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fiscal_doc_store_status ON fiscal_doc (org_id, store_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fiscal_doc_unarchived ON fiscal_doc (org_id, store_id, accepted_at) WHERE archive_id IS NULL;
--> statement-breakpoint
ALTER TABLE store_change DROP CONSTRAINT IF EXISTS store_change_entity;
--> statement-breakpoint
ALTER TABLE store_change ADD CONSTRAINT store_change_entity CHECK (entity IN ('product', 'price', 'tax-rule', 'barcode-mapping', 'customer', 'org-setting', 'fiscal-doc'));
--> statement-breakpoint
ALTER TABLE asset ADD COLUMN IF NOT EXISTS verified_sha256 text;
