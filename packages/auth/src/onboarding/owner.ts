import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { defineCommand } from "@shopper/audit";
import { account, member, role, user } from "@shopper/db-pg";
import { seedRoleRows } from "../roles/service";

export const createVerifiedOwner = defineCommand({
  name: "auth.owner.create",
  async run(tx, context, input: { name: string; email: string; password: string }) {
    await seedRoleRows(tx, context.orgId);
    const [ownerRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.protectedOwner, true)));
    if (!ownerRole) throw new Error("Protected owner role is missing");
    const [owner] = await tx
      .insert(user)
      .values({ orgId: context.orgId, name: input.name, email: input.email, emailVerified: true })
      .returning({ id: user.id });
    if (!owner) throw new Error("Owner creation failed");
    await tx.insert(account).values({
      orgId: context.orgId,
      accountId: owner.id,
      providerId: "credential",
      userId: owner.id,
      password: await hashPassword(input.password),
    });
    await tx.insert(member).values({
      orgId: context.orgId,
      organizationId: context.orgId,
      userId: owner.id,
      role: "owner",
      roleId: ownerRole.id,
    });
    return { userId: owner.id, roleId: ownerRole.id };
  },
  audit: (_input, output) => output,
});
