import { sha256 } from "@shopper/utils";
import * as v from "valibot";
import { and, eq, isNull, gt } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  branch,
  device,
  member,
  org,
  deviceEnrollment,
  deviceCredential,
  cashierPin,
  cashierSession,
  enrollmentAttempt,
} from "@shopper/db-pg";
import { enrollmentIssueInput, enrollmentInput } from "../schemas/devices";

export class DeviceError extends Error {
  constructor(
    message: string,
    public status: 400 | 401 | 403 | 404 | 409 | 429 = 401,
    /** When a lockout lifts, so the register can name the time. */
    public lockedUntil?: string | null,
  ) {
    super(message);
  }
}
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export { sha256 as digest } from "@shopper/utils";
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
        codeHash: await sha256(code),
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
          eq(deviceEnrollment.codeHash, await sha256(input.code)),
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
      .values({ orgId: c.orgId, deviceId: row!.id, tokenHash: await sha256(deviceToken) });
    const [location] = await tx
      .select({ code: branch.code, storeId: branch.storeId, name: branch.name })
      .from(branch)
      .where(and(eq(branch.orgId, c.orgId), eq(branch.id, challenge.branchId)));
    if (!row || !location) throw new DeviceError("Enrollment location not found", 404);
    return {
      deviceId: row.id,
      branchId: challenge.branchId,
      // The till's identity names its store and branch; it has nothing else to read them from yet.
      storeId: location.storeId,
      branchName: location.name,
      deviceToken,
      receiptCodes: { branchCode: location.code, deviceCode: row.code },
    };
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
