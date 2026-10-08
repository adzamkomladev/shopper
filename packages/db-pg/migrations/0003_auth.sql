ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "slug" text NOT NULL DEFAULT uuidv7()::text;
--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "logo" text;
--> statement-breakpoint
ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_slug_unique') THEN
    ALTER TABLE "org" ADD CONSTRAINT "org_slug_unique" UNIQUE ("slug");
  END IF;
END;
$$;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "image" text;
--> statement-breakpoint
ALTER TABLE "permission" ADD COLUMN IF NOT EXISTS "till_allowed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "org"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "active_organization_id" uuid,
  FOREIGN KEY ("org_id", "user_id") REFERENCES "user"("org_id", "id"),
  FOREIGN KEY ("org_id", "active_organization_id") REFERENCES "org"("org_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "org"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  FOREIGN KEY ("org_id", "user_id") REFERENCES "user"("org_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "org"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "org"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "role_id" uuid NOT NULL,
  CONSTRAINT "member_org_id_organization_id_user_id_unique" UNIQUE ("org_id", "organization_id", "user_id"),
  FOREIGN KEY ("org_id", "organization_id") REFERENCES "org"("org_id", "id"),
  FOREIGN KEY ("org_id", "user_id") REFERENCES "user"("org_id", "id"),
  FOREIGN KEY ("org_id", "role_id") REFERENCES "role"("org_id", "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "org"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp with time zone NOT NULL,
  "inviter_id" uuid NOT NULL,
  FOREIGN KEY ("org_id", "organization_id") REFERENCES "org"("org_id", "id"),
  FOREIGN KEY ("org_id", "inviter_id") REFERENCES "user"("org_id", "id")
);
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['session', 'account', 'verification', 'member', 'invitation'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'touch_updated_at' || '_' || table_name
    ) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION shopper_touch_updated_at()', 'touch_updated_at' || '_' || table_name, table_name);
    END IF;
  END LOOP;
END;
$$;
