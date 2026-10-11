import * as v from "valibot";
import { and, eq, isNull, gt } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  device,
  role,
  member,
  deviceCredential,
  cashierSession,
  type ShopperDatabase,
} from "@shopper/db-pg";
import type { Cache } from "@shopper/ports";
import type { AuthPrincipal } from "./roles";
import {
  DeviceError,
  assign,
  cashierLoginInput,
  consume,
  digest,
  enrollmentInput,
  enrollmentIssueInput,
  issue,
  loginCommand,
  pinInput,
  revokeDeviceInput,
} from "./device-commands";

export { DeviceError } from "./device-commands";
export type DevicePrincipal = AuthPrincipal;

const revokeCommand = defineCommand({
  name: "device.revoke",
  async run(tx, c, input: { deviceId: string }) {
    const [row] = await tx
      .update(deviceCredential)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(deviceCredential.orgId, c.orgId), eq(deviceCredential.deviceId, input.deviceId)),
      )
      .returning();
    if (!row) throw new DeviceError("Device not found", 404);
    await tx
      .update(cashierSession)
      .set({ revokedAt: new Date() })
      .where(and(eq(cashierSession.orgId, c.orgId), eq(cashierSession.deviceId, input.deviceId)));
    return { deviceId: input.deviceId };
  },
  audit: (input) => ({ deviceId: input.deviceId }),
});

export function createDeviceService(
  db: ShopperDatabase,
  cache: Cache,
  appVersion: string,
  orgId?: string,
) {
  const ctx = (p: DevicePrincipal): CommandContext => ({
    orgId: p.orgId,
    actorId: p.userId,
    role: p.roleName,
    deviceId: p.deviceId,
    branchId: p.branchId,
    appVersion,
  });
  const credential = async (deviceId: string, token: string) => {
    const [row] = await db
      .select({ device })
      .from(deviceCredential)
      .innerJoin(
        device,
        and(eq(device.id, deviceCredential.deviceId), eq(device.orgId, deviceCredential.orgId)),
      )
      .where(
        and(
          eq(deviceCredential.deviceId, deviceId),
          eq(deviceCredential.tokenHash, await digest(token)),
          isNull(deviceCredential.revokedAt),
        ),
      );
    if (!row) throw new DeviceError("Invalid device credential");
    return row.device;
  };
  return {
    issueEnrollment: (p: DevicePrincipal, input: unknown) =>
      issue(db, ctx(p), v.parse(enrollmentIssueInput, input)),
    async enroll(input: unknown) {
      const data = v.parse(enrollmentInput, input);
      data.orgId = data.orgId.toLowerCase();
      if (orgId && data.orgId !== orgId.toLowerCase()) throw new DeviceError("Invalid enrollment");
      const result = await consume(db, { orgId: data.orgId, appVersion }, data);
      if ("error" in result) throw new DeviceError(result.error!, result.status!);
      return result;
    },
    async assignPin(p: DevicePrincipal, input: unknown) {
      const data = v.parse(pinInput, input);
      return assign(db, ctx(p), { userId: data.userId, pinHash: await hashPassword(data.pin) });
    },
    async login(input: unknown) {
      const data = v.parse(cashierLoginInput, input);
      const d = await credential(data.deviceId, data.deviceToken);
      if (orgId && d.orgId !== orgId.toLowerCase())
        throw new DeviceError("Invalid device credential");
      let scope: ReturnType<Cache["request"]> | undefined;
      try {
        scope = cache.request();
      } catch {
        // PostgreSQL remains authoritative when the optional cache is unavailable.
      }
      const result = await loginCommand(
        db,
        { orgId: d.orgId, deviceId: d.id, branchId: d.branchId, appVersion },
        data,
      );
      if (scope && "attempts" in result) {
        try {
          await scope.put(
            d.orgId,
            `pin/${data.userId}`,
            {
              attempts: "attempts" in result ? (result.attempts ?? 0) : 0,
              lockedUntil: "lockedUntil" in result ? (result.lockedUntil ?? null) : null,
            },
            15 * 60000,
          );
        } catch {
          // Never discard committed session credentials because their cache mirror failed.
        }
      }
      if ("error" in result) throw new DeviceError(result.error!, result.status!);
      return { token: result.token!, expiresAt: result.expiresAt! };
    },
    revoke: (p: DevicePrincipal, input: unknown) =>
      revokeCommand(db, ctx(p), v.parse(revokeDeviceInput, input)),
    async resolveDevicePrincipal(request: Request): Promise<DevicePrincipal | null> {
      const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
      const deviceToken = request.headers.get("x-shopper-device-token");
      if (!token || !deviceToken) return null;
      const [row] = await db
        .select({ session: cashierSession, device, role })
        .from(cashierSession)
        .innerJoin(
          device,
          and(
            eq(device.id, cashierSession.deviceId),
            eq(device.orgId, cashierSession.orgId),
            eq(device.branchId, cashierSession.branchId),
          ),
        )
        .innerJoin(
          deviceCredential,
          and(eq(deviceCredential.deviceId, device.id), eq(deviceCredential.orgId, device.orgId)),
        )
        .innerJoin(
          member,
          and(
            eq(member.orgId, cashierSession.orgId),
            eq(member.userId, cashierSession.userId),
            eq(member.roleId, cashierSession.roleId),
          ),
        )
        .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
        .where(
          and(
            eq(cashierSession.tokenHash, await digest(token)),
            gt(cashierSession.expiresAt, new Date()),
            isNull(cashierSession.revokedAt),
            eq(deviceCredential.tokenHash, await digest(deviceToken)),
            isNull(deviceCredential.revokedAt),
          ),
        );
      if (row && orgId && row.session.orgId !== orgId.toLowerCase()) return null;
      return row
        ? {
            orgId: row.session.orgId,
            userId: row.session.userId,
            roleId: row.role.id,
            roleName: row.role.name,
            deviceId: row.device.id,
            branchId: row.device.branchId,
          }
        : null;
    },
  };
}
