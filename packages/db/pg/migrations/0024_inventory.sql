ALTER TABLE branch ADD COLUMN IF NOT EXISTS alert_phones text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE branch DROP CONSTRAINT IF EXISTS branch_alert_phones;
--> statement-breakpoint
ALTER TABLE branch ADD CONSTRAINT branch_alert_phones CHECK (cardinality(alert_phones) <= 3);
--> statement-breakpoint
ALTER TABLE stock_document ALTER COLUMN device_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE stock_document ADD COLUMN IF NOT EXISTS supplier_id uuid;
--> statement-breakpoint
ALTER TABLE stock_document ADD COLUMN IF NOT EXISTS cause text;
--> statement-breakpoint
ALTER TABLE stock_document DROP CONSTRAINT IF EXISTS stock_document_org_id_supplier_id_supplier_org_id_id_fk;
--> statement-breakpoint
ALTER TABLE stock_document ADD CONSTRAINT stock_document_org_id_supplier_id_supplier_org_id_id_fk FOREIGN KEY (org_id, supplier_id) REFERENCES supplier(org_id, id);
--> statement-breakpoint
ALTER TABLE stock_document DROP CONSTRAINT IF EXISTS stock_document_kind;
--> statement-breakpoint
ALTER TABLE stock_document ADD CONSTRAINT stock_document_kind CHECK (kind IN ('count', 'receipt', 'adjustment'));
--> statement-breakpoint
ALTER TABLE stock_document DROP CONSTRAINT IF EXISTS stock_document_cause;
--> statement-breakpoint
ALTER TABLE stock_document ADD CONSTRAINT stock_document_cause CHECK ((kind = 'adjustment') = (cause IS NOT NULL));
--> statement-breakpoint
ALTER TABLE stock_document DROP CONSTRAINT IF EXISTS stock_document_cause_value;
--> statement-breakpoint
ALTER TABLE stock_document ADD CONSTRAINT stock_document_cause_value CHECK (cause IS NULL OR cause IN ('damaged', 'expired', 'theft', 'found', 'other'));
--> statement-breakpoint
ALTER TABLE stock_document DROP CONSTRAINT IF EXISTS stock_document_receipt_source;
--> statement-breakpoint
ALTER TABLE stock_document ADD CONSTRAINT stock_document_receipt_source CHECK (kind <> 'receipt' OR device_id IS NOT NULL OR supplier_id IS NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_document_kind ON stock_document USING btree (org_id, branch_id, kind, occurred_at);
--> statement-breakpoint
ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS unit_cost bigint;
--> statement-breakpoint
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_unit_cost;
--> statement-breakpoint
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_unit_cost CHECK (unit_cost IS NULL OR (reason = 'receipt' AND unit_cost >= 0));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reorder_point (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  level_thousandths bigint NOT NULL,
  CONSTRAINT reorder_point_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT reorder_point_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT reorder_point_org_id_branch_id_product_id_unique UNIQUE (org_id, branch_id, product_id),
  CONSTRAINT reorder_point_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT reorder_point_org_id_product_id_product_org_id_id_fk FOREIGN KEY (org_id, product_id) REFERENCES product(org_id, id),
  CONSTRAINT reorder_point_level CHECK (level_thousandths >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS stock_alert (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  level_thousandths bigint NOT NULL,
  on_hand_thousandths bigint NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT stock_alert_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT stock_alert_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT stock_alert_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT stock_alert_org_id_product_id_product_org_id_id_fk FOREIGN KEY (org_id, product_id) REFERENCES product(org_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_open ON stock_alert USING btree (org_id, branch_id, product_id) WHERE cleared_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS stock_take (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  scope text NOT NULL,
  category_id uuid,
  status text NOT NULL DEFAULT 'open',
  started_by uuid NOT NULL,
  closed_by uuid,
  closed_at timestamptz,
  CONSTRAINT stock_take_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT stock_take_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT stock_take_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT stock_take_org_id_category_id_category_org_id_id_fk FOREIGN KEY (org_id, category_id) REFERENCES category(org_id, id),
  CONSTRAINT stock_take_org_id_started_by_user_org_id_id_fk FOREIGN KEY (org_id, started_by) REFERENCES "user"(org_id, id),
  CONSTRAINT stock_take_org_id_closed_by_user_org_id_id_fk FOREIGN KEY (org_id, closed_by) REFERENCES "user"(org_id, id),
  CONSTRAINT stock_take_scope CHECK (scope IN ('full', 'category')),
  CONSTRAINT stock_take_status CHECK (status IN ('open', 'posted', 'cancelled')),
  CONSTRAINT stock_take_category CHECK ((scope = 'category') = (category_id IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS stock_take_open ON stock_take USING btree (org_id, branch_id) WHERE status = 'open';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS stock_take_line (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  take_id uuid NOT NULL,
  product_id uuid NOT NULL,
  counted_thousandths bigint,
  counted_at timestamptz,
  counted_by uuid,
  expected_thousandths bigint,
  CONSTRAINT stock_take_line_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT stock_take_line_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT stock_take_line_org_id_take_id_product_id_unique UNIQUE (org_id, take_id, product_id),
  CONSTRAINT stock_take_line_org_id_take_id_stock_take_org_id_id_fk FOREIGN KEY (org_id, take_id) REFERENCES stock_take(org_id, id),
  CONSTRAINT stock_take_line_org_id_product_id_product_org_id_id_fk FOREIGN KEY (org_id, product_id) REFERENCES product(org_id, id),
  CONSTRAINT stock_take_line_org_id_counted_by_user_org_id_id_fk FOREIGN KEY (org_id, counted_by) REFERENCES "user"(org_id, id),
  CONSTRAINT stock_take_line_counted CHECK (counted_thousandths >= 0),
  CONSTRAINT stock_take_line_count_set CHECK ((counted_thousandths IS NULL) = (counted_at IS NULL) AND (counted_at IS NULL) = (counted_by IS NULL))
);
