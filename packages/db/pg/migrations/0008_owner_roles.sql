ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "protected_owner" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "role" SET "protected_owner" = true WHERE "name" = 'superadmin';
--> statement-breakpoint
UPDATE "member" m SET "role" = 'owner' FROM "role" r
WHERE m.org_id = r.org_id AND m.role_id = r.id AND r.protected_owner;
--> statement-breakpoint
INSERT INTO "permission" (org_id, code, till_allowed)
SELECT o.id, p.code, false FROM org o
CROSS JOIN (VALUES ('user.read'), ('role.read'), ('device.read')) p(code)
ON CONFLICT (org_id, code) DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM "role" r
JOIN "permission" p ON p.org_id = r.org_id
WHERE (r.protected_owner OR r.name = 'admin') AND p.code IN ('user.read', 'role.read', 'device.read')
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
