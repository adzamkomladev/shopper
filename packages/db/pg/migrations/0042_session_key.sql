-- Day 40: the key cashier-session grants are signed with, one per org, kept in the database so a box restored from
-- an older dump still verifies a grant signed after it. Every existing org gets its key here, so tonight's dump holds
-- it; an org created later gets one at its first sign-in. Replayable.
CREATE TABLE IF NOT EXISTS "session_key" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "session_key_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "session_key" DROP CONSTRAINT IF EXISTS "session_key_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "session_key" ("org_id", "key")
SELECT "id", encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex') FROM "org"
ON CONFLICT ("org_id") DO NOTHING;
