ALTER TABLE org ADD COLUMN IF NOT EXISTS branch_counter integer NOT NULL DEFAULT 0;
ALTER TABLE branch ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT '';
ALTER TABLE branch ADD COLUMN IF NOT EXISTS device_counter integer NOT NULL DEFAULT 0;
ALTER TABLE device ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT '';
ALTER TABLE device ADD COLUMN IF NOT EXISTS receipt_last integer NOT NULL DEFAULT 0;
ALTER TABLE device ADD COLUMN IF NOT EXISTS receipt_used integer NOT NULL DEFAULT 0;
ALTER TABLE sale ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE sale ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION assign_branch_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE counter integer;
BEGIN
 UPDATE org SET branch_counter = branch_counter + 1 WHERE id = NEW.org_id RETURNING branch_counter INTO counter;
 NEW.code := 'BR' || lpad(counter::text, greatest(2,length(counter::text)), '0'); RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS branch_code ON branch;
CREATE TRIGGER branch_code BEFORE INSERT ON branch FOR EACH ROW EXECUTE FUNCTION assign_branch_code();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION assign_device_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE counter integer;
BEGIN
 UPDATE branch SET device_counter = device_counter + 1 WHERE org_id = NEW.org_id AND id = NEW.branch_id RETURNING device_counter INTO counter;
 NEW.code := 'T' || lpad(counter::text, greatest(2,length(counter::text)), '0'); RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS device_code ON device;
CREATE TRIGGER device_code BEFORE INSERT ON device FOR EACH ROW EXECUTE FUNCTION assign_device_code();
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS branch_org_code_unique ON branch(org_id,code) WHERE code <> '';
CREATE UNIQUE INDEX IF NOT EXISTS device_branch_code_unique ON device(branch_id,code) WHERE code <> '';
CREATE UNIQUE INDEX IF NOT EXISTS sale_receipt_unique ON sale(org_id,receipt_number);
CREATE TABLE IF NOT EXISTS receipt_block (
 id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL REFERENCES org(id),
 device_id uuid NOT NULL, start integer NOT NULL, "end" integer NOT NULL,
 UNIQUE(device_id,start), CHECK(start > 0 AND "end" >= start),
 FOREIGN KEY(org_id,device_id) REFERENCES device(org_id,id)
);
