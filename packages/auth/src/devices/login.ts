import * as v from "valibot";
import { and, eq, isNull } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { defineCommand } from "@shopper/audit";
import {
  role,
  rolePermission,
  permission,
  member,
  deviceCredential,
  cashierPin,
  cashierSession,
} from "@shopper/db-pg";
import { cashierLoginInput } from "../schemas/devices";
import { digest, minutes, randomToken } from "./commands";

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
    c.actorId = input.userId.toLowerCase();
    c.role = membership.roleName;
    await tx
      .update(cashierPin)
      .set({ attempts: 0, lockedUntil: null })
      .where(eq(cashierPin.id, record.id));
    const grants = await tx
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(
        permission,
        and(
          eq(permission.orgId, rolePermission.orgId),
          eq(permission.id, rolePermission.permissionId),
        ),
      )
      .where(
        and(
          eq(rolePermission.orgId, c.orgId),
          eq(rolePermission.roleId, membership.roleId),
          eq(permission.tillAllowed, true),
        ),
      );
    const permissions = grants.map((grant) => grant.code).sort();
    const token = randomToken();
    const issuedAt = new Date();
    const expiresAt = minutes(8 * 60);
    const [session] = await tx
      .insert(cashierSession)
      .values({
        orgId: c.orgId,
        deviceId: input.deviceId,
        branchId: c.branchId!,
        userId: input.userId,
        roleId: membership.roleId,
        tokenHash: await digest(token),
        issuedAt,
        permissions,
        roleName: membership.roleName,
        expiresAt,
      })
      .returning();
    // The single-row insert returns the newly issued session.
    return {
      id: session!.id,
      token,
      issuedAt,
      expiresAt,
      permissions,
      roleName: membership.roleName,
      attempts: 0,
      lockedUntil: null,
    };
  },
  audit: (input, result) => ({ userId: input.userId, success: !("error" in result) }),
});
