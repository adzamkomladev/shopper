import * as v from "valibot";
import { and, eq, isNull, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  branch,
  device,
  role,
  member,
  org,
  deviceEnrollment,
  deviceCredential,
  cashierPin,
  cashierSession,
  enrollmentAttempt,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { uuidV7Schema, type Cache } from "@shopper/ports";
export interface DevicePrincipal {
  orgId: string;
  userId: string;
  roleId: string;
  roleName: string;
  deviceId?: string;
  branchId?: string;
}
export class DeviceError extends Error {
  constructor(
    message: string,
    public status: 400 | 401 | 404 | 409 | 429 = 401,
  ) {
    super(message);
  }
}
const id = uuidV7Schema;
const pin = v.pipe(v.string(), v.regex(/^\d{4,8}$/));
export const enrollmentIssueInput = v.strictObject({ branchId: id });
export const enrollmentInput = v.strictObject({
  orgId: id,
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
export const pinInput = v.strictObject({ userId: id, pin });
export const cashierLoginInput = v.strictObject({
  deviceId: id,
  deviceToken: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  userId: id,
  pin,
});
export const revokeDeviceInput = v.strictObject({ deviceId: id });
const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const minutes = (n: number) => new Date(Date.now() + n * 60000);
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
  const issue = defineCommand({
    name: "device.enrollment.issue",
    async run(tx, c, input: v.InferOutput<typeof enrollmentIssueInput>) {
      const [found] = await tx
        .select()
        .from(branch)
        .where(and(eq(branch.orgId, c.orgId), eq(branch.id, input.branchId)));
      if (!found) throw new DeviceError("Branch not found", 404);
      const number = crypto.getRandomValues(new Uint32Array(1))[0]!;
      const code = String(number % 1000000).padStart(6, "0");
      const expiresAt = minutes(10);
      // One active challenge per organization avoids ambiguous six-digit code matches.
      await tx
        .update(deviceEnrollment)
        .set({ consumedAt: new Date() })
        .where(and(eq(deviceEnrollment.orgId, c.orgId), isNull(deviceEnrollment.consumedAt)));
      const [row] = await tx
        .insert(deviceEnrollment)
        .values({
          orgId: c.orgId,
          branchId: input.branchId,
          codeHash: await digest(code),
          expiresAt,
        })
        .returning();
      return {
        orgId: c.orgId,
        enrollmentId: row!.id,
        code,
        expiresAt,
        qrPayload: JSON.stringify({ orgId: c.orgId, code }),
      };
    },
    audit: (input, result) => ({ branchId: input.branchId, enrollmentId: result.enrollmentId }),
  });
  const consume = defineCommand({
    name: "device.enrollment.consume",
    async run(tx, c, input: v.InferOutput<typeof enrollmentInput>) {
      const now = new Date();
      const [tenant] = await tx.select({ id: org.id }).from(org).where(eq(org.id, c.orgId));
      if (!tenant) throw new DeviceError("Invalid enrollment", 401);
      const [budget] = await tx
        .select()
        .from(enrollmentAttempt)
        .where(eq(enrollmentAttempt.orgId, c.orgId));
      const attempts = budget && budget.lockedUntil > now ? budget.attempts : 0;
      if (attempts >= 5) return { error: "Enrollment temporarily locked", status: 429 as const };
      const [challenge] = await tx
        .select()
        .from(deviceEnrollment)
        .where(
          and(
            eq(deviceEnrollment.orgId, c.orgId),
            eq(deviceEnrollment.codeHash, await digest(input.code)),
            isNull(deviceEnrollment.consumedAt),
            gt(deviceEnrollment.expiresAt, now),
          ),
        );
      if (!challenge) {
        // ponytail: organization-wide guess budget can deny enrollments; use RateLimiter per origin if needed.
        await tx
          .insert(enrollmentAttempt)
          .values({
            orgId: c.orgId,
            attempts: attempts + 1,
            lockedUntil: budget && budget.lockedUntil > now ? budget.lockedUntil : minutes(15),
          })
          .onConflictDoUpdate({
            target: enrollmentAttempt.orgId,
            set: {
              attempts: attempts + 1,
              lockedUntil: budget && budget.lockedUntil > now ? budget.lockedUntil : minutes(15),
            },
          });
        return { error: "Invalid or expired enrollment code", status: 401 as const };
      }
      await tx
        .update(deviceEnrollment)
        .set({ consumedAt: now })
        .where(eq(deviceEnrollment.id, challenge.id));
      const [row] = await tx
        .insert(device)
        .values({ orgId: c.orgId, branchId: challenge.branchId, name: input.name })
        .returning();
      const deviceToken = randomToken();
      await tx
        .insert(deviceCredential)
        .values({ orgId: c.orgId, deviceId: row!.id, tokenHash: await digest(deviceToken) });
      return { deviceId: row!.id, branchId: challenge.branchId, deviceToken };
    },
    audit: (_input, result) =>
      "error" in result ? { success: false } : { success: true, deviceId: result.deviceId },
  });
  const assign = defineCommand({
    name: "cashier.pin.assign",
    async run(tx, c, input: { userId: string; pinHash: string }) {
      const [membership] = await tx
        .select()
        .from(member)
        .where(and(eq(member.orgId, c.orgId), eq(member.userId, input.userId)));
      if (!membership) throw new DeviceError("User is not an organization member", 404);
      await tx
        .insert(cashierPin)
        .values({ orgId: c.orgId, userId: input.userId, pinHash: input.pinHash })
        .onConflictDoUpdate({
          target: [cashierPin.orgId, cashierPin.userId],
          set: { pinHash: input.pinHash, attempts: 0, lockedUntil: null },
        });
      await tx
        .update(cashierSession)
        .set({ revokedAt: new Date() })
        .where(and(eq(cashierSession.orgId, c.orgId), eq(cashierSession.userId, input.userId)));
      return { userId: input.userId };
    },
    audit: (input) => ({ userId: input.userId }),
  });
  const loginCommand = defineCommand({
    name: "cashier.login",
    async run(tx, c, input: v.InferOutput<typeof cashierLoginInput>) {
      const [registered] = await tx
        .select()
        .from(deviceCredential)
        .where(
          and(
            eq(deviceCredential.orgId, c.orgId),
            eq(deviceCredential.deviceId, input.deviceId),
            eq(deviceCredential.tokenHash, await digest(input.deviceToken)),
            isNull(deviceCredential.revokedAt),
          ),
        );
      if (!registered) return { error: "Invalid device credential", status: 401 as const };
      const [record] = await tx
        .select()
        .from(cashierPin)
        .where(and(eq(cashierPin.orgId, c.orgId), eq(cashierPin.userId, input.userId)));
      if (!record) return { error: "Invalid PIN", status: 401 as const };
      if (record.lockedUntil && record.lockedUntil > new Date())
        return {
          error: "PIN temporarily locked",
          status: 429 as const,
          attempts: record.attempts,
          lockedUntil: record.lockedUntil.toISOString(),
        };
      const attempts = record.lockedUntil ? 0 : record.attempts;
      if (!(await verifyPassword({ hash: record.pinHash, password: input.pin }))) {
        const lockedUntil = attempts + 1 >= 5 ? minutes(15) : null;
        await tx
          .update(cashierPin)
          .set({ attempts: attempts + 1, lockedUntil })
          .where(eq(cashierPin.id, record.id));
        return {
          error: "Invalid PIN",
          status: 401 as const,
          attempts: attempts + 1,
          lockedUntil: lockedUntil?.toISOString() ?? null,
        };
      }
      const [membership] = await tx
        .select({ roleId: member.roleId, roleName: role.name })
        .from(member)
        .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
        .where(and(eq(member.orgId, c.orgId), eq(member.userId, input.userId)));
      if (!membership) return { error: "Invalid PIN", status: 401 as const };
      c.actorId = input.userId;
      c.role = membership.roleName;
      await tx
        .update(cashierPin)
        .set({ attempts: 0, lockedUntil: null })
        .where(eq(cashierPin.id, record.id));
      const token = randomToken();
      const expiresAt = minutes(8 * 60);
      await tx.insert(cashierSession).values({
        orgId: c.orgId,
        deviceId: input.deviceId,
        branchId: c.branchId!,
        userId: input.userId,
        roleId: membership.roleId,
        tokenHash: await digest(token),
        expiresAt,
      });
      return { token, expiresAt, attempts: 0, lockedUntil: null };
    },
    audit: (input, result) => ({ userId: input.userId, success: !("error" in result) }),
  });
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
        await scope.get(d.orgId, `pin/${data.userId}`);
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
