import * as v from "valibot";
import { and, eq, isNull } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  role,
  rolePermission,
  permission,
  member,
  user,
  deviceCredential,
  cashierPin,
  cashierSession,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { cashierLoginInput } from "../schemas/devices";
import { digest, minutes, randomToken } from "./commands";
import { deactivated, passwordIdentity } from "./password";
import { verifyPin } from "./pin";
import type { Identity, Rejected } from "./types";

/** The 401 message for a revoked or unknown device token; the till tells it apart from bad credentials. */
export const invalidDeviceCredential = "Invalid device credential";

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
    if (!registered) return { error: invalidDeviceCredential, status: 401 as const };
    const identity =
      "email" in input
        ? await passwordIdentity(tx, c.orgId, input)
        : await pinIdentity(tx, c.orgId, input);
    if ("error" in identity) return identity;
    const { userId, name, roleId, roleName } = identity;
    c.actorId = userId.toLowerCase();
    c.role = roleName;
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
          eq(rolePermission.roleId, roleId),
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
        userId,
        roleId: roleId,
        tokenHash: await digest(token),
        issuedAt,
        permissions,
        roleName: roleName,
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
      roleName: roleName,
      userId,
      userName: name,
      attempts: 0,
      lockedUntil: null,
    };
  },
  audit: (input, result) => ({
    userId: "userId" in input ? input.userId : "userId" in result ? result.userId : null,
    success: !("error" in result),
  }),
});

async function pinIdentity(
  tx: ShopperTransaction,
  orgId: string,
  input: Extract<v.InferOutput<typeof cashierLoginInput>, { pin: string }>,
): Promise<Identity | Rejected> {
  const [record] = await tx
    .select()
    .from(cashierPin)
    .where(and(eq(cashierPin.orgId, orgId), eq(cashierPin.userId, input.userId)));
  if (!record) return { error: "Invalid PIN", status: 401 };
  if (record.lockedUntil && record.lockedUntil > new Date())
    return {
      error: "PIN temporarily locked",
      status: 429,
      attempts: record.attempts,
      lockedUntil: record.lockedUntil.toISOString(),
    };
  const attempts = record.lockedUntil ? 0 : record.attempts;
  if (!(await verifyPin(record.pinHash, input.pin))) {
    const lockedUntil = attempts + 1 >= 5 ? minutes(15) : null;
    await tx
      .update(cashierPin)
      .set({ attempts: attempts + 1, lockedUntil })
      .where(eq(cashierPin.id, record.id));
    return {
      error: "Invalid PIN",
      status: 401,
      attempts: attempts + 1,
      lockedUntil: lockedUntil?.toISOString() ?? null,
    };
  }
  const [membership] = await tx
    .select({
      roleId: member.roleId,
      roleName: role.name,
      name: user.name,
      deactivatedAt: member.deactivatedAt,
    })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .innerJoin(user, and(eq(user.orgId, member.orgId), eq(user.id, member.userId)))
    .where(and(eq(member.orgId, orgId), eq(member.userId, input.userId)));
  if (!membership) return { error: "Invalid PIN", status: 401 };
  await tx
    .update(cashierPin)
    .set({ attempts: 0, lockedUntil: null })
    .where(eq(cashierPin.id, record.id));
  const { deactivatedAt, ...identity } = membership;
  if (deactivatedAt) return { error: deactivated, status: 403 };
  return { userId: input.userId, ...identity };
}
