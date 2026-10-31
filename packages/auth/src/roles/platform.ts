import { and, eq, inArray } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { permission, role, rolePermission } from "@shopper/db-pg";

/**
 * What Shopper staff may do across shops. Only the platform org has these rows, and only its protected owner role
 * is granted them here, so no shop's role can ever hold them, whatever it is given in its own org.
 */
export const platformPermissionNames = [
  "platform.tenant.read",
  "platform.tenant.update",
  "platform.kyb.review",
] as const;

/** Gives the platform org its permission rows and grants them to its owner role; replaying changes nothing. */
export const seedPlatformRoles = defineCommand({
  name: "auth.platform.seed",
  async run(tx, context) {
    await tx
      .insert(permission)
      .values(
        platformPermissionNames.map((code) => ({ orgId: context.orgId, code, tillAllowed: false })),
      )
      .onConflictDoNothing();
    const [owner] = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.protectedOwner, true)));
    if (!owner) throw new Error("The platform org has no owner role: seed its roles first");
    const rows = await tx
      .select({ id: permission.id })
      .from(permission)
      .where(
        and(
          eq(permission.orgId, context.orgId),
          inArray(permission.code, [...platformPermissionNames]),
        ),
      );
    await tx
      .insert(rolePermission)
      .values(rows.map((row) => ({ orgId: context.orgId, roleId: owner.id, permissionId: row.id })))
      .onConflictDoNothing();
    return { permissions: rows.length };
  },
  audit: (_input, output) => output,
});
