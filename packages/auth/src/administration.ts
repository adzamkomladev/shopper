import { and, asc, count, eq, isNull } from "drizzle-orm";
import {
  member,
  permission,
  role,
  rolePermission,
  user,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { AdministrationError } from "./roles/service";

type Database = ShopperDatabase | ShopperTransaction;

export function listUsers(db: Database, orgId: string) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      roleId: role.id,
      roleName: role.name,
      protectedOwner: role.protectedOwner,
    })
    .from(user)
    .innerJoin(member, and(eq(member.orgId, user.orgId), eq(member.userId, user.id)))
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(eq(user.orgId, orgId))
    .orderBy(asc(user.name), asc(user.id));
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
