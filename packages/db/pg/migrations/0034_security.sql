-- Day 26: staff.unlock lifts a PIN or password lockout early. Till-allowed, so a manager's PIN unlocks a
-- register offline. Granted to the roles that already hold every staff grant; replayable.
INSERT INTO permission (org_id, code, till_allowed)
SELECT o.id, 'staff.unlock', true FROM org o
WHERE EXISTS (SELECT 1 FROM role r WHERE r.org_id = o.id)
ON CONFLICT (org_id, code) DO UPDATE SET till_allowed = true;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM role r
JOIN permission p ON p.org_id = r.org_id
WHERE (r.protected_owner OR r.name IN ('superadmin', 'admin')) AND p.code = 'staff.unlock'
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
