import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  cashierPin,
  member,
  permission,
  rolePermission,
  user,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { approvalPermissions } from "@shopper/core/schemas";
import { atBranch } from "../members/target";

/**
 * Active members allowed at the register's branch with a PIN and a till-allowed approval grant: what it keeps to
 * approve offline.
 */
export async function listApprovers(db: ShopperDatabase, orgId: string, branchId: string) {
  const rows = await db
    .select({
      userId: cashierPin.userId,
      name: user.name,
      pinHash: cashierPin.pinHash,
      code: permission.code,
    })
    .from(cashierPin)
    .innerJoin(user, and(eq(user.orgId, cashierPin.orgId), eq(user.id, cashierPin.userId)))
    .innerJoin(
      member,
      and(eq(member.orgId, cashierPin.orgId), eq(member.userId, cashierPin.userId)),
    )
    .innerJoin(
      rolePermission,
      and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
    )
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
        eq(permission.tillAllowed, true),
        inArray(permission.code, [...approvalPermissions]),
      ),
    )
    .where(and(eq(cashierPin.orgId, orgId), isNull(member.deactivatedAt), atBranch(db, branchId)));
  const approvers = new Map<
    string,
    { userId: string; name: string; pinHash: string; permissions: string[] }
  >();
  for (const { code, ...row } of rows) {
    const approver = approvers.get(row.userId) ?? { ...row, permissions: [] };
    approver.permissions.push(code);
    approvers.set(row.userId, approver);
  }
  return [...approvers.values()];
}

/** Who may still sign in at the register's branch: a till forgets everyone else's offline sign-in. */
export async function listStaff(db: ShopperDatabase, orgId: string, branchId: string) {
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.orgId, orgId), isNull(member.deactivatedAt), atBranch(db, branchId)));
  return rows.map((row) => row.userId);
}
