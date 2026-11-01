-- Day 30: shoppers' online accounts. A phone proves itself with a code (shop_login), a browser holds a session
-- (shop_session) whose token is kept only as a digest, and an account keeps its delivery addresses. Replayable.
CREATE TABLE IF NOT EXISTS "shop_account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"email" text,
	CONSTRAINT "shop_account_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "shop_account_phone" UNIQUE("org_id","phone"),
	CONSTRAINT "shop_account_phone_format" CHECK ("shop_account"."phone" ~ '^0[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_address" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"label" text NOT NULL,
	"line1" text NOT NULL,
	"area" text NOT NULL,
	"city" text NOT NULL,
	"landmark" text,
	"phone" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "shop_address_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "shop_address_phone_format" CHECK ("shop_address"."phone" ~ '^0[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_login" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text NOT NULL,
	"otp_digest" text,
	"expires_at" timestamp with time zone NOT NULL,
	"sends" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "shop_login_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "shop_login_phone_format" CHECK ("shop_login"."phone" ~ '^0[0-9]{9}$'),
	CONSTRAINT "shop_login_sends" CHECK ("shop_login"."sends" BETWEEN 1 AND 3),
	CONSTRAINT "shop_login_attempts" CHECK ("shop_login"."attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "shop_session_org_id_id_unique" UNIQUE("org_id","id"),
	CONSTRAINT "shop_session_token" UNIQUE("token_digest")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_account" ADD CONSTRAINT "shop_account_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_address" ADD CONSTRAINT "shop_address_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_address" ADD CONSTRAINT "shop_address_org_id_account_id_shop_account_org_id_id_fk" FOREIGN KEY ("org_id","account_id") REFERENCES "public"."shop_account"("org_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_login" ADD CONSTRAINT "shop_login_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_session" ADD CONSTRAINT "shop_session_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_session" ADD CONSTRAINT "shop_session_org_id_account_id_shop_account_org_id_id_fk" FOREIGN KEY ("org_id","account_id") REFERENCES "public"."shop_account"("org_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_address_default" ON "shop_address" USING btree ("org_id","account_id") WHERE "shop_address"."is_default";