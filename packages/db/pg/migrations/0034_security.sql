-- Day 26: staff.unlock lifts a PIN or password lockout early. Till-allowed, so a manager's PIN unlocks a
-- register offline. Granted to the owner and to every role that already assigns PINs (permissions are data,
-- so never by role name); replayable.
INSERT INTO permission (org_id, code, till_allowed)
SELECT o.id, 'staff.unlock', true FROM org o
WHERE EXISTS (SELECT 1 FROM role r WHERE r.org_id = o.id)
ON CONFLICT (org_id, code) DO UPDATE SET till_allowed = true;
--> statement-breakpoint
INSERT INTO role_permission (org_id, role_id, permission_id)
SELECT r.org_id, r.id, p.id FROM role r
JOIN permission p ON p.org_id = r.org_id AND p.code = 'staff.unlock'
WHERE r.protected_owner OR EXISTS (
  SELECT 1 FROM role_permission rp
  JOIN permission pin ON pin.id = rp.permission_id AND pin.org_id = rp.org_id
  WHERE rp.org_id = r.org_id AND rp.role_id = r.id AND pin.code = 'cashier.pin.assign'
)
ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
