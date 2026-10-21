CREATE TABLE IF NOT EXISTS shift (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  device_id uuid NOT NULL,
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  opened_at timestamptz NOT NULL,
  opened_by uuid NOT NULL,
  closed_at timestamptz NOT NULL,
  closed_by uuid NOT NULL,
  session_id uuid NOT NULL,
  approver_id uuid,
  float bigint NOT NULL,
  variance_threshold bigint NOT NULL,
  expected_cash bigint NOT NULL,
  declared_cash bigint NOT NULL,
  report jsonb NOT NULL,
  anchor_seq bigint NOT NULL,
  anchor_hash text NOT NULL,
  event_version bigint NOT NULL DEFAULT 1,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL,
  CONSTRAINT shift_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT shift_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT shift_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT shift_org_id_store_id_store_org_id_id_fk FOREIGN KEY (org_id, store_id) REFERENCES store(org_id, id),
  CONSTRAINT shift_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT shift_org_id_closed_by_user_org_id_id_fk FOREIGN KEY (org_id, closed_by) REFERENCES "user"(org_id, id),
  CONSTRAINT shift_org_id_approver_id_user_org_id_id_fk FOREIGN KEY (org_id, approver_id) REFERENCES "user"(org_id, id),
  CONSTRAINT shift_org_id_session_id_cashier_session_org_id_id_fk FOREIGN KEY (org_id, session_id) REFERENCES cashier_session(org_id, id),
  CONSTRAINT shift_amounts CHECK (float >= 0 AND variance_threshold >= 0 AND declared_cash >= 0),
  CONSTRAINT shift_anchor CHECK (anchor_seq >= 0 AND anchor_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT shift_event_version_positive CHECK (event_version > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shift_closed ON shift (org_id, closed_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shift_tender (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  shift_id uuid NOT NULL,
  tender text NOT NULL,
  sales bigint NOT NULL,
  refunds bigint NOT NULL,
  expected bigint NOT NULL,
  declared bigint NOT NULL,
  variance bigint NOT NULL,
  CONSTRAINT shift_tender_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT shift_tender_org_id_shift_id_tender_unique UNIQUE (org_id, shift_id, tender),
  CONSTRAINT shift_tender_org_id_shift_id_shift_org_id_id_fk FOREIGN KEY (org_id, shift_id) REFERENCES shift(org_id, id),
  CONSTRAINT shift_tender_kind CHECK (tender IN ('cash', 'momo', 'card')),
  CONSTRAINT shift_tender_variance CHECK (variance = declared - expected)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shift_movement (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  shift_id uuid NOT NULL,
  kind text NOT NULL,
  amount bigint NOT NULL,
  reason text,
  actor_id uuid NOT NULL,
  at timestamptz NOT NULL,
  CONSTRAINT shift_movement_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT shift_movement_org_id_shift_id_shift_org_id_id_fk FOREIGN KEY (org_id, shift_id) REFERENCES shift(org_id, id),
  CONSTRAINT shift_movement_kind CHECK ((kind = 'drop' AND amount > 0) OR (kind = 'no_sale' AND amount = 0 AND reason IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shift_movement_shift ON shift_movement (org_id, shift_id);
