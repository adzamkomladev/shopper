import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { ageSession, context } from "./server-data";
import { ids } from "./sales";

export async function enrollFixtureTill(
  db: ShopperDatabase,
  devices: ReturnType<typeof createDeviceService>,
  principal: { orgId: string; userId: string; roleId: string; roleName: string },
) {
  const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
  const enrolled = await devices.enroll({
    orgId: context.orgId,
    code: challenge.code,
    name: "Sync till",
  });
  const login = await devices.login({
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  const issuedAt = new Date("2025-12-31T16:00:00.000Z");
  const expiresAt = new Date("2026-01-01T08:00:00.000Z");
  await ageSession(db, context, { sessionId: login.id, issuedAt, expiresAt });
  return {
    ...enrolled,
    session: {
      id: login.id,
      orgId: context.orgId,
      deviceId: enrolled.deviceId,
      branchId: ids.branch,
      userId: principal.userId,
      roleName: login.roleName,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      permissions: login.permissions,
      proof: login.token,
    },
  };
}
