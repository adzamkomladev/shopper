ALTER TABLE member ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS member_org_id_deactivated_at_idx ON member USING btree (org_id, deactivated_at);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE member ADD CONSTRAINT member_org_id_id_unique UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS member_branch (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  CONSTRAINT member_branch_org_id_org_id_fk FOREIGN KEY (org_id) REFERENCES org(id),
  CONSTRAINT member_branch_org_id_member_id_member_org_id_id_fk FOREIGN KEY (org_id, member_id) REFERENCES member(org_id, id) ON DELETE CASCADE,
  CONSTRAINT member_branch_org_id_branch_id_branch_org_id_id_fk FOREIGN KEY (org_id, branch_id) REFERENCES branch(org_id, id),
  CONSTRAINT member_branch_org_id_member_id_branch_id_unique UNIQUE (org_id, member_id, branch_id)
);
--> statement-breakpoint
ALTER TABLE role ADD COLUMN IF NOT EXISTS archived_at timestamptz;
--> statement-breakpoint
ALTER TABLE role DROP CONSTRAINT IF EXISTS role_org_id_name_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS role_org_id_name_active ON role USING btree (org_id, name) WHERE archived_at IS NULL;
