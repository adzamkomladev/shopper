-- Day 27: each org's registers follow one till release feed. New orgs and every shop today are on `stable`; a
-- platform admin moves a pilot shop to `pilot`. Replayable.
ALTER TABLE org ADD COLUMN IF NOT EXISTS update_channel text NOT NULL DEFAULT 'stable';
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE org ADD CONSTRAINT org_update_channel CHECK (update_channel IN ('pilot', 'stable'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- platform.tenant.update moves a shop between channels. Only the platform org holds platform codes: it is the org
-- whose roles already hold platform.tenant.read, and the code goes to the roles that do.
INSERT INTO permission (org_id, code, till_allowed)
SELECT DISTINCT p.org_id, 'platform.tenant.update', false FROM permission p
WHERE p.code = 'platform.tenant.read'
ON CONFLICT (org_id, code) DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT rp.org_id, rp.role_id, up.id FROM role_permission rp
JOIN permission rd ON rd.id = rp.permission_id AND rd.org_id = rp.org_id AND rd.code = 'platform.tenant.read'
JOIN permission up ON up.org_id = rp.org_id AND up.code = 'platform.tenant.update'
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
