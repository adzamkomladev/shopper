CREATE TABLE IF NOT EXISTS refund (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  device_id uuid NOT NULL,
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  session_id uuid NOT NULL,
  approver_id uuid,
  original_sale_id uuid NOT NULL,
  reason text NOT NULL,
  tender_kind text NOT NULL,
  tender_reference text,
  gross bigint NOT NULL,
  cash_rounding bigint NOT NULL,
  total bigint NOT NULL,
  app_version text NOT NULL,
  event_version bigint NOT NULL DEFAULT 1,
  device_time timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  receipt jsonb,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  CONSTRAINT refund_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT refund_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT refund_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT refund_org_id_store_id_store_org_id_id_fk FOREIGN KEY (org_id, store_id) REFERENCES store(org_id, id),
  CONSTRAINT refund_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT refund_org_id_cashier_id_user_org_id_id_fk FOREIGN KEY (org_id, cashier_id) REFERENCES "user"(org_id, id),
  CONSTRAINT refund_org_id_approver_id_user_org_id_id_fk FOREIGN KEY (org_id, approver_id) REFERENCES "user"(org_id, id),
  CONSTRAINT refund_org_id_session_id_cashier_session_org_id_id_fk FOREIGN KEY (org_id, session_id) REFERENCES cashier_session(org_id, id),
  CONSTRAINT refund_org_id_original_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, original_sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT refund_tender_kind CHECK (tender_kind IN ('cash', 'momo', 'card')),
  CONSTRAINT refund_tender_reference CHECK (tender_kind = 'cash' OR (tender_reference IS NOT NULL AND tender_reference <> '')),
  CONSTRAINT refund_amounts CHECK (gross >= 0 AND total >= 0),
  CONSTRAINT refund_event_version_positive CHECK (event_version > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS refund_sale ON refund (org_id, original_sale_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS refund_line (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  refund_id uuid NOT NULL,
  original_line_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity_thousandths bigint NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT refund_line_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT refund_line_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT refund_line_org_id_refund_id_refund_org_id_id_fk FOREIGN KEY (org_id, refund_id) REFERENCES refund(org_id, id),
  CONSTRAINT refund_line_org_id_original_line_id_sale_line_org_id_id_fk FOREIGN KEY (org_id, original_line_id) REFERENCES sale_line(org_id, id),
  CONSTRAINT refund_line_org_id_product_id_product_org_id_id_fk FOREIGN KEY (org_id, product_id) REFERENCES product(org_id, id),
  CONSTRAINT refund_line_quantity CHECK (quantity_thousandths > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS refund_line_original ON refund_line (org_id, original_line_id);
--> statement-breakpoint
ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS refund_id uuid;
--> statement-breakpoint
ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS refund_line_id uuid;
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_org_id_refund_id_refund_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_org_id_refund_id_refund_org_id_id_fk
  FOREIGN KEY (org_id, refund_id) REFERENCES refund(org_id, id);
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_org_id_refund_line_id_refund_line_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_org_id_refund_line_id_refund_line_org_id_id_fk
  FOREIGN KEY (org_id, refund_line_id) REFERENCES refund_line(org_id, id);
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_return;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_return
  CHECK (reason <> 'return' OR (refund_id IS NOT NULL AND quantity_thousandths > 0));
