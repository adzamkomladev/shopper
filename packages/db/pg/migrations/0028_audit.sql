CREATE TABLE IF NOT EXISTS audit_anchor (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  day date NOT NULL,
  stream text NOT NULL,
  chain_seq bigint NOT NULL,
  hash text NOT NULL,
  CONSTRAINT audit_anchor_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT audit_anchor_org_id_day_stream_unique UNIQUE (org_id, day, stream),
  CONSTRAINT audit_anchor_hash CHECK (hash ~ '^[0-9a-f]{64}$' AND chain_seq >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS device_audit (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  command text NOT NULL,
  role text,
  device_id uuid NOT NULL,
  branch_id uuid,
  entity text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  approver_id uuid,
  device_time timestamptz,
  chain_seq bigint NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  actor_id uuid,
  app_version text NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT device_audit_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT device_audit_org_id_device_id_device_org_id_id_fk FOREIGN KEY (org_id, device_id) REFERENCES device(org_id, id),
  CONSTRAINT device_audit_org_id_device_id_chain_seq_unique UNIQUE (org_id, device_id, chain_seq),
  CONSTRAINT device_audit_chain_shape CHECK (hash ~ '^[0-9a-f]{64}$' AND prev_hash ~ '^[0-9a-f]{64}$' AND chain_seq > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_anchor_stream ON audit_anchor (org_id, stream, chain_seq);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS device_audit_viewer ON device_audit (org_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS device_audit_entity ON device_audit (org_id, entity, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS device_audit_actor ON device_audit (org_id, actor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS device_audit_command ON device_audit (org_id, command);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_viewer ON audit_log (org_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_entity ON audit_log (org_id, entity, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_actor ON audit_log (org_id, actor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_device ON audit_log (org_id, device_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_log_command ON audit_log (org_id, command);
--> statement-breakpoint
CREATE OR REPLACE TRIGGER device_audit_append_only BEFORE UPDATE OR DELETE ON device_audit
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER device_audit_no_truncate BEFORE TRUNCATE ON device_audit
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_anchor_append_only BEFORE UPDATE OR DELETE ON audit_anchor
FOR EACH ROW EXECUTE FUNCTION shopper_reject_history_change();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_anchor_no_truncate BEFORE TRUNCATE ON audit_anchor
FOR EACH STATEMENT EXECUTE FUNCTION shopper_reject_history_change();
