CREATE TABLE IF NOT EXISTS device_enrollment (id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL REFERENCES org(id), branch_id uuid NOT NULL, code_hash text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, FOREIGN KEY(org_id,branch_id) REFERENCES branch(org_id,id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS device_credential (id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL REFERENCES org(id), device_id uuid NOT NULL, token_hash text NOT NULL UNIQUE, revoked_at timestamptz, UNIQUE(org_id,device_id), FOREIGN KEY(org_id,device_id) REFERENCES device(org_id,id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cashier_pin (id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL REFERENCES org(id), user_id uuid NOT NULL, pin_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), locked_until timestamptz, UNIQUE(org_id,user_id), FOREIGN KEY(org_id,user_id) REFERENCES "user"(org_id,id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cashier_session (id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL REFERENCES org(id), device_id uuid NOT NULL, branch_id uuid NOT NULL, user_id uuid NOT NULL, role_id uuid NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, FOREIGN KEY(org_id,device_id) REFERENCES device(org_id,id), FOREIGN KEY(org_id,branch_id) REFERENCES branch(org_id,id), FOREIGN KEY(org_id,user_id) REFERENCES "user"(org_id,id), FOREIGN KEY(org_id,role_id) REFERENCES role(org_id,id));

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS enrollment_attempt (id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL UNIQUE REFERENCES org(id), attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), locked_until timestamptz NOT NULL);
