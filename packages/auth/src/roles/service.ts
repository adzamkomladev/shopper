export type { AuthPrincipal } from "./types";
import { and, eq, isNull, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  member,
  permission,
  role,
  rolePermission,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";

import { permissionNames } from "../schemas/permissions";
import { rolePermissions, tillPermissions } from "./defaults";

/** Every principal the API, the auth service and the device service hand around. */

export async function seedRoleRows(tx: ShopperTransaction, orgId: string) {
  await tx
    .insert(permission)
    .values(
      permissionNames.map((code) => ({ orgId, code, tillAllowed: tillPermissions.has(code) })),
    )
    .onConflictDoUpdate({
      target: [permission.orgId, permission.code],
      set: { tillAllowed: sql`excluded.till_allowed` },
    });
  const createdRoles = await tx
    .insert(role)
    .values(
      Object.keys(rolePermissions).map((name) => ({
        orgId,
        name,
        protectedOwner: name === "superadmin",
      })),
    )
    .onConflictDoNothing()
    .returning({ id: role.id });
  const [permissionRows, roleRows] = await Promise.all([
    tx
      .select({ id: permission.id, code: permission.code })
      .from(permission)
      .where(eq(permission.orgId, orgId)),
    tx
      .select({ id: role.id, name: role.name, protectedOwner: role.protectedOwner })
      .from(role)
      .where(eq(role.orgId, orgId)),
  ]);
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const newIds = new Set(createdRoles.map(({ id }) => id));
  const roleIds = new Map(
    roleRows
      .filter((row) => row.protectedOwner || newIds.has(row.id))
      .map((row) => [row.name, row.id]),
  );
  const ownerLinks = roleRows
    .filter((row) => row.protectedOwner)
    .flatMap((row) =>
      permissionRows
        .filter(({ code }) => permissionNames.includes(code as (typeof permissionNames)[number]))
        .map(({ id }) => ({ orgId, roleId: row.id, permissionId: id })),
    );
  const links = Object.entries(rolePermissions).flatMap(([roleName, codes]) =>
    codes.flatMap((code) => {
      const permissionId = permissionIds.get(code);
      const roleId = roleIds.get(roleName);
      return permissionId && roleId ? [{ orgId, roleId, permissionId }] : [];
    }),
  );
  if (links.length || ownerLinks.length)
    await tx
      .insert(rolePermission)
      .values([...links, ...ownerLinks])
      .onConflictDoNothing();
  return {
    roleCount: Object.keys(rolePermissions).length,
    permissionCount: permissionNames.length,
  };
}

export const seedAuthRoles = defineCommand({
  name: "auth.roles.seed",
  run: (tx, context) => seedRoleRows(tx, context.orgId),
  audit: (_input, output) => output,
});

/**
 * Permission codes an active member holds through role_permission; a deactivated member holds none. Till sessions
 * only get till-allowed codes.
 */
export function grantedCodes(
  db: ShopperDatabase | ShopperTransaction,
  orgId: string,
  userId: string,
  options: { deviceId?: string; roleId?: string; code?: string } = {},
) {
  const conditions = [
    eq(member.orgId, orgId),
    eq(member.userId, userId),
    isNull(member.deactivatedAt),
  ];
  if (options.roleId) conditions.push(eq(member.roleId, options.roleId));
  if (options.code) conditions.push(eq(permission.code, options.code));
  if (options.deviceId) conditions.push(eq(permission.tillAllowed, true));
  return db
    .select({ code: permission.code })
    .from(member)
    .innerJoin(
      rolePermission,
      and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
    )
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(and(...conditions));
}

export async function assertHasPermission(
  tx: ShopperTransaction,
  context: CommandContext,
  code: string,
) {
  if (!context.actorId) throw new AdministrationError("An authenticated actor is required", 401);
  const found = await grantedCodes(tx, context.orgId, context.actorId, {
    code,
    deviceId: context.deviceId,
  }).limit(1);
  if (!found.length) throw new AdministrationError("Permission denied", 403);
}

export async function assertCanGrantRole(
  tx: ShopperTransaction,
  context: CommandContext,
  targetRoleId: string,
) {
  await assertHasPermission(tx, context, "role.write");
  const [actorRows, grantRows] = await Promise.all([
    grantedCodes(tx, context.orgId, context.actorId!, { deviceId: context.deviceId }),
    tx
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(
        permission,
        and(
          eq(permission.orgId, rolePermission.orgId),
          eq(permission.id, rolePermission.permissionId),
        ),
      )
      .where(and(eq(rolePermission.orgId, context.orgId), eq(rolePermission.roleId, targetRoleId))),
  ]);
  const actorCodes = new Set(actorRows.map(({ code }) => code));
  const [target] = await tx
    .select({ protectedOwner: role.protectedOwner })
    .from(role)
    .where(and(eq(role.orgId, context.orgId), eq(role.id, targetRoleId), isNull(role.archivedAt)));
  if (!target) throw new AdministrationError("Role not found in this organization", 404);
  const [owner] = await tx
    .select({ id: member.id })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(
      and(
        eq(member.orgId, context.orgId),
        eq(member.userId, context.actorId!),
        eq(role.protectedOwner, true),
      ),
    );
  if (grantRows.some(({ code }) => !actorCodes.has(code)))
    throw new AdministrationError("Cannot grant permissions you do not hold", 403);
  if (target.protectedOwner && !owner)
    throw new AdministrationError("Only an owner can grant the owner role", 403);
}

export class AdministrationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409,
  ) {
    super(message);
  }
}
