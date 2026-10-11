import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { account, member, role, user } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { assertCanGrantRole, assertHasPermission } from "./roles";

const assignRoleInput = v.strictObject({ userId: uuidV7Schema, roleId: uuidV7Schema });

export const assignMemberRole = defineCommand({
  name: "auth.member.assign-role",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(assignRoleInput, rawInput);
    await assertHasPermission(tx, context, "role.write");
    const [targetUser] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.orgId, context.orgId), eq(user.id, input.userId)))
      .limit(1);
    const [targetRole] = await tx
      .select({ id: role.id, name: role.name })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
      .limit(1);
    if (!targetUser || !targetRole) throw new Error("User or role not found in this organization");
    await assertCanGrantRole(tx, context, targetRole.id);
    const [assigned] = await tx
      .insert(member)
      .values({
        orgId: context.orgId,
        organizationId: context.orgId,
        userId: input.userId,
        role: "member",
        roleId: input.roleId,
      })
      .onConflictDoUpdate({
        target: [member.orgId, member.organizationId, member.userId],
        set: { role: "member", roleId: input.roleId },
      })
      .returning({ id: member.id });
    return {
      memberId: assigned!.id,
      userId: input.userId,
      roleId: targetRole.id,
      roleName: targetRole.name,
    };
  },
  audit: (input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "member", entityId: output.memberId, after: output }),
});

const registerUserInput = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  roleId: uuidV7Schema,
});
export const registerOrganizationUser = defineCommand({
  name: "auth.user.register",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(registerUserInput, rawInput);
    await assertHasPermission(tx, context, "user.write");
    await assertHasPermission(tx, context, "role.write");
    const [targetRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
      .limit(1);
    if (!targetRole) throw new Error("Role not found in this organization");
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
        role: "member",
        roleId: targetRole.id,
      })
      .returning({ id: member.id });
    return { userId: created!.id, memberId: assigned!.id, roleId: targetRole.id };
  },
  audit: (_input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, after: output }),
});
