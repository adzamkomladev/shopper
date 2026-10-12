import * as v from "valibot";
import { and, eq, isNull, gt } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { defineCommand } from "@shopper/audit";
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
} from "@shopper/db-pg";
import { enrollmentIssueInput, enrollmentInput, cashierLoginInput } from "../schemas/devices";

export class DeviceError extends Error {
  constructor(
    message: string,
    public status: 400 | 401 | 404 | 409 | 429 = 401,
  ) {
    super(message);
  }
}
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const digest = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export const minutes = (n: number) => new Date(Date.now() + n * 60000);

export const issue = defineCommand({
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
export const consume = defineCommand({
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
export const assign = defineCommand({
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
export const loginCommand = defineCommand({
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
