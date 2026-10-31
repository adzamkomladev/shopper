import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import {
  cashierPin,
  member,
  memberBranch,
  permission,
  role,
  rolePermission,
  user,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { AdministrationError } from "./roles/service";

type Database = ShopperDatabase | ShopperTransaction;

export async function listUsers(db: Database, orgId: string) {
  const rows = await db
    .select({
      memberId: member.id,
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      roleId: role.id,
      roleName: role.name,
      protectedOwner: role.protectedOwner,
      deactivatedAt: member.deactivatedAt,
      // The later of the PIN and password lockouts, while either still holds.
      lockedUntil: sql<
        string | null
      >`(SELECT max(locked) FROM (VALUES (${user.passwordLockedUntil}), (${cashierPin.lockedUntil})) AS lock(locked) WHERE locked > now())`,
    })
    .from(user)
    .innerJoin(member, and(eq(member.orgId, user.orgId), eq(member.userId, user.id)))
    .leftJoin(cashierPin, and(eq(cashierPin.orgId, user.orgId), eq(cashierPin.userId, user.id)))
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(eq(user.orgId, orgId))
    .orderBy(asc(user.name), asc(user.id));
  const scopes = await db
    .select({ memberId: memberBranch.memberId, branchId: memberBranch.branchId })
    .from(memberBranch)
    .where(eq(memberBranch.orgId, orgId))
    .orderBy(asc(memberBranch.branchId));
  return rows.map(({ memberId, ...row }) => ({
    ...row,
    branchIds: scopes.filter((scope) => scope.memberId === memberId).map((scope) => scope.branchId),
  }));
}

export async function listRoles(db: Database, orgId: string) {
  const rows = await db
    .select({ id: role.id, name: role.name, protectedOwner: role.protectedOwner })
    .from(role)
    .where(and(eq(role.orgId, orgId), isNull(role.archivedAt)))
    .orderBy(asc(role.name), asc(role.id));
  const grants = await db
    .select({ roleId: rolePermission.roleId, code: permission.code })
    .from(rolePermission)
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(eq(rolePermission.orgId, orgId))
    .orderBy(asc(permission.code));
  const holders = await db
    .select({ roleId: member.roleId, n: count() })
    .from(member)
    .where(eq(member.orgId, orgId))
    .groupBy(member.roleId);
  return rows.map((row) => ({
    ...row,
    permissionCodes: grants.filter((grant) => grant.roleId === row.id).map(({ code }) => code),
    memberCount: holders.find((holder) => holder.roleId === row.id)?.n ?? 0,
  }));
}

export async function readRole(db: Database, orgId: string, id: string) {
  const found = (await listRoles(db, orgId)).find((row) => row.id === id);
  if (!found) throw new AdministrationError("Role not found in this organization", 404);
  return found;
}

export function listPermissions(db: Database, orgId: string) {
  return db
    .select({ id: permission.id, code: permission.code, tillAllowed: permission.tillAllowed })
    .from(permission)
    .where(eq(permission.orgId, orgId))
    .orderBy(asc(permission.code));
}
