import { and, eq, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  member,
  permission,
  role,
  rolePermission,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";

/** Every principal the API, the auth service and the device service hand around. */
export interface AuthPrincipal {
  orgId: string;
  userId: string;
  roleId: string;
  roleName: string;
  deviceId?: string;
  branchId?: string;
}

const permissionNames = [
  "sale.create",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
  "stock.read",
  "stock.write",
  "product.read",
  "product.write",
  "product.propose",
  "tax.read",
  "tax.write",
  "report.read",
  "audit.read",
  "user.write",
  "role.write",
  "store.read",
  "store.write",
  "branch.read",
  "branch.write",
  "device.enroll",
  "device.revoke",
  "cashier.pin.assign",
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  superadmin: permissionNames,
  admin: permissionNames.filter(
    (code) => !code.startsWith("store.") && !code.startsWith("branch.") && code !== "tax.write",
  ),
  accountant: ["product.read", "shift.read", "stock.read", "tax.read", "report.read", "audit.read"],
  inventory: ["product.read", "stock.read", "stock.write", "product.propose"],
  cashier: ["product.read", "sale.create", "refund.request", "shift.read", "shift.write"],
};
const tillPermissions = new Set([
  "product.read",
  "sale.create",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
]);

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
  await tx
    .insert(role)
    .values(Object.keys(rolePermissions).map((name) => ({ orgId, name })))
    .onConflictDoNothing();
  const [permissionRows, roleRows] = await Promise.all([
    tx
      .select({ id: permission.id, code: permission.code })
      .from(permission)
      .where(eq(permission.orgId, orgId)),
    tx.select({ id: role.id, name: role.name }).from(role).where(eq(role.orgId, orgId)),
  ]);
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleIds = new Map(roleRows.map((row) => [row.name, row.id]));
  const links = Object.entries(rolePermissions).flatMap(([roleName, codes]) =>
    codes.flatMap((code) => {
      const permissionId = permissionIds.get(code);
      const roleId = roleIds.get(roleName);
      return permissionId && roleId ? [{ orgId, roleId, permissionId }] : [];
    }),
  );
  if (links.length) await tx.insert(rolePermission).values(links).onConflictDoNothing();
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

/** Permission codes a member holds through role_permission. Till sessions only get till-allowed codes. */
export function grantedCodes(
  db: ShopperDatabase | ShopperTransaction,
  orgId: string,
  userId: string,
  options: { deviceId?: string; roleId?: string; code?: string } = {},
) {
  const conditions = [eq(member.orgId, orgId), eq(member.userId, userId)];
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
  if (!context.actorId) throw new Error("An authenticated actor is required");
  const found = await grantedCodes(tx, context.orgId, context.actorId, {
    code,
    deviceId: context.deviceId,
  }).limit(1);
  if (!found.length) throw new Error("Permission denied");
}

export async function assertCanGrantRole(
  tx: ShopperTransaction,
  context: CommandContext,
  targetRoleId: string,
) {
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
  if (grantRows.some(({ code }) => !actorCodes.has(code)))
    throw new Error("Cannot grant permissions you do not hold");
}
