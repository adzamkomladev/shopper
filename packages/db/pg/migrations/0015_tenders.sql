ALTER TABLE org ADD COLUMN IF NOT EXISTS cash_rounding text NOT NULL DEFAULT '10p';
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_cash_rounding' AND conrelid = 'org'::regclass) THEN
    ALTER TABLE org ADD CONSTRAINT org_cash_rounding CHECK (cash_rounding IN ('none', '10p'));
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payment (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  device_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  reference text NOT NULL,
  amount bigint NOT NULL,
  phone text NOT NULL,
  network text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  failure_reason text,
  CONSTRAINT payment_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT payment_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT payment_org_id_reference_unique UNIQUE (org_id, reference),
  CONSTRAINT payment_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT payment_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT payment_org_id_cashier_id_user_org_id_id_fk FOREIGN KEY (org_id, cashier_id) REFERENCES "user"(org_id, id),
  CONSTRAINT payment_amount CHECK (amount > 0 AND amount % 100 = 0),
  CONSTRAINT payment_network CHECK (network IN ('mtn', 'telecel', 'airteltigo')),
  CONSTRAINT payment_status CHECK (status IN ('pending', 'otp', 'confirmed', 'failed', 'expired'))
);
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS total bigint;
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS cash_rounding bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS paid bigint;
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS change bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sale ADD COLUMN IF NOT EXISTS receipt jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sale_tender (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sale_id uuid NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  amount bigint NOT NULL,
  reference text,
  approval_code text,
  last4 text,
  network text,
  payment_id uuid,
  CONSTRAINT sale_tender_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT sale_tender_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT sale_tender_org_id_sale_id_position_unique UNIQUE (org_id, sale_id, position),
  CONSTRAINT sale_tender_org_id_payment_id_unique UNIQUE (org_id, payment_id),
  CONSTRAINT sale_tender_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT sale_tender_org_id_payment_id_payment_org_id_id_fk FOREIGN KEY (org_id, payment_id) REFERENCES payment(org_id, id),
  CONSTRAINT sale_tender_kind CHECK (kind IN ('cash', 'momo', 'card')),
  CONSTRAINT sale_tender_amount CHECK (amount > 0),
  CONSTRAINT sale_tender_position CHECK (position >= 0),
  CONSTRAINT sale_tender_momo_payment CHECK (kind <> 'momo' OR payment_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS stock_movement (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  sale_id uuid,
  sale_line_id uuid,
  quantity_thousandths bigint NOT NULL,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movement_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT stock_movement_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT stock_movement_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT stock_movement_org_id_product_id_product_org_id_id_fk FOREIGN KEY (org_id, product_id) REFERENCES product(org_id, id),
  CONSTRAINT stock_movement_org_id_sale_id_sale_org_id_id_fk FOREIGN KEY (org_id, sale_id) REFERENCES sale(org_id, id),
  CONSTRAINT stock_movement_org_id_sale_line_id_sale_line_org_id_id_fk FOREIGN KEY (org_id, sale_line_id) REFERENCES sale_line(org_id, id),
  CONSTRAINT stock_movement_reason CHECK (reason IN ('sale', 'adjustment', 'return')),
  CONSTRAINT stock_movement_quantity CHECK (quantity_thousandths <> 0),
  CONSTRAINT stock_movement_sale CHECK (reason <> 'sale' OR (sale_id IS NOT NULL AND quantity_thousandths < 0))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_movement_product ON stock_movement (org_id, branch_id, product_id, occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_movement_sale ON stock_movement (org_id, sale_id);
