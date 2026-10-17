CREATE TABLE IF NOT EXISTS stock_document (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  device_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  payload jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_document_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT stock_document_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT stock_document_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT stock_document_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT stock_document_org_id_actor_id_user_org_id_id_fk FOREIGN KEY (org_id, actor_id) REFERENCES "user"(org_id, id),
  CONSTRAINT stock_document_kind CHECK (kind IN ('count', 'receipt'))
);
--> statement-breakpoint
ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS document_id uuid;
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_org_id_document_id_stock_document_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_org_id_document_id_stock_document_org_id_id_fk
  FOREIGN KEY (org_id, document_id) REFERENCES stock_document(org_id, id);
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_reason;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_reason
  CHECK (reason IN ('sale', 'adjustment', 'return', 'count', 'receipt'));
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_document;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_document
  CHECK (reason NOT IN ('count', 'receipt') OR document_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_receipt;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_receipt
  CHECK (reason <> 'receipt' OR quantity_thousandths > 0);
