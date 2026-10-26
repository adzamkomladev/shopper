import { and, eq, isNull, ne } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { account, member, role, user, type ShopperTransaction } from "@shopper/db-pg";
import { assignRoleInput, registerUserInput } from "./schemas/users";
import { assertCanGrantRole, assertHasPermission, AdministrationError } from "./roles/service";

export const assignMemberRole = defineCommand({
  name: "auth.member.assign-role",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(assignRoleInput, rawInput);
    await assertHasPermission(tx, context, "role.write");
    return grantMemberRole(tx, context, input);
  },
  audit: (input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "member", entityId: output.memberId, after: output }),
});

/**
 * Gives a member a role inside the caller's command: the role must exist, the actor must hold every
 * permission it carries, and the last owner stays an owner. Shared by role assignment and KYC approval.
 */
export async function grantMemberRole(
  tx: ShopperTransaction,
  context: CommandContext,
  input: v.InferOutput<typeof assignRoleInput>,
) {
  const [targetUser] = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.orgId, context.orgId), eq(user.id, input.userId)))
    .limit(1);
  const [targetRole] = await tx
    .select({ id: role.id, name: role.name, protectedOwner: role.protectedOwner })
    .from(role)
    .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
    .limit(1);
  if (!targetUser || !targetRole)
    throw new AdministrationError("User or role not found in this organization", 404);
  await assertCanGrantRole(tx, context, targetRole.id);
  const [previous] = await tx
    .select({ roleId: member.roleId, protectedOwner: role.protectedOwner })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(and(eq(member.orgId, context.orgId), eq(member.userId, input.userId)));
  if (previous?.protectedOwner && !targetRole.protectedOwner) {
    // Another active owner must remain: a deactivated one can't run the organization.
    const [other] = await tx
      .select({ id: member.id })
      .from(member)
      .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
      .where(
        and(
          eq(member.orgId, context.orgId),
          eq(role.protectedOwner, true),
          isNull(member.deactivatedAt),
          ne(member.userId, input.userId),
        ),
      )
      .limit(1);
    if (!other) throw new AdministrationError("The last owner cannot be demoted", 409);
  }
  const [assigned] = await tx
    .insert(member)
    .values({
      orgId: context.orgId,
      organizationId: context.orgId,
      userId: input.userId,
      role: targetRole.protectedOwner ? "owner" : "member",
      roleId: input.roleId,
    })
    .onConflictDoUpdate({
      target: [member.orgId, member.organizationId, member.userId],
      set: { role: targetRole.protectedOwner ? "owner" : "member", roleId: input.roleId },
    })
    .returning({ id: member.id });
  return {
    memberId: assigned!.id,
    userId: input.userId,
    roleId: targetRole.id,
    roleName: targetRole.name,
  };
}

export const registerOrganizationUser = defineCommand({
  name: "auth.user.register",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(registerUserInput, rawInput);
    await assertHasPermission(tx, context, "user.write");
    await assertHasPermission(tx, context, "role.write");
    const [targetRole] = await tx
      .select({ id: role.id, protectedOwner: role.protectedOwner })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
      .limit(1);
    if (!targetRole) throw new AdministrationError("Role not found in this organization", 404);
    await assertCanGrantRole(tx, context, targetRole.id);
    const [created] = await tx
      .insert(user)
      .values({
        orgId: context.orgId,
        name: input.name,
        email: input.email.toLowerCase(),
      })
      .returning({ id: user.id });
    await tx.insert(account).values({
      orgId: context.orgId,
      accountId: created!.id,
      providerId: "credential",
      userId: created!.id,
      password: await hashPassword(input.password),
    });
    const [assigned] = await tx
      .insert(member)
      .values({
        orgId: context.orgId,
        organizationId: context.orgId,
        userId: created!.id,
        role: targetRole.protectedOwner ? "owner" : "member",
        roleId: targetRole.id,
      })
      .returning({ id: member.id });
    return { userId: created!.id, memberId: assigned!.id, roleId: targetRole.id };
  },
  audit: (_input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, after: output }),
});
