-- Day 41: the Shopper Archive. `export_job` tracks an archive an owner asked for; `archive_key` is the per-org Ed25519
-- key it is signed with, kept in the database so a restored box signs with the same key. Replayable.
CREATE TABLE IF NOT EXISTS "archive_key" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"private_key" text NOT NULL,
	"public_key" text NOT NULL,
	CONSTRAINT "archive_key_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_job" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"requested_by" uuid,
	"files" integer DEFAULT 0 NOT NULL,
	"rows" bigint DEFAULT 0 NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"manifest_sha256" text,
	"missing_blobs" integer DEFAULT 0 NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "export_job_org_id_id_unique" UNIQUE("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "archive_key" DROP CONSTRAINT IF EXISTS "archive_key_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "archive_key" ADD CONSTRAINT "archive_key_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" DROP CONSTRAINT IF EXISTS "export_job_org_id_org_id_fk";--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" DROP CONSTRAINT IF EXISTS "export_job_org_id_requested_by_user_org_id_id_fk";--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_org_id_requested_by_user_org_id_id_fk" FOREIGN KEY ("org_id","requested_by") REFERENCES "public"."user"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- export.run: exporting the business's data. Not till-allowed. Granted to the owner and to every role that already
-- manages roles (permissions are data, so never by role name); replayable.
INSERT INTO permission (org_id, code, till_allowed)
SELECT o.id, 'export.run', false FROM org o
WHERE EXISTS (SELECT 1 FROM role r WHERE r.org_id = o.id)
ON CONFLICT (org_id, code) DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM role r
JOIN permission p ON p.org_id = r.org_id AND p.code = 'export.run'
WHERE r.protected_owner OR EXISTS (
  SELECT 1 FROM role_permission rp
  JOIN permission held ON held.id = rp.permission_id AND held.org_id = rp.org_id
  WHERE rp.org_id = r.org_id AND rp.role_id = r.id AND held.code = 'role.write'
)
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
