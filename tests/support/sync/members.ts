import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/core";
import { databases, devices, principal } from "../till/server";

const addMember = defineCommand({
  name: "sync.test.member",
  async run(tx, ctx, input: { name: string; roleName: string }) {
    const [role] = await tx
      .select()
      .from(schema.role)
      .where(and(eq(schema.role.orgId, ctx.orgId), eq(schema.role.name, input.roleName)));
    const [user] = await tx
      .insert(schema.user)
      .values({ id: v7(), orgId: ctx.orgId, name: input.name, email: `${v7()}@test.invalid` })
      .returning();
    await tx.insert(schema.member).values({
      orgId: ctx.orgId,
      organizationId: ctx.orgId,
      userId: user!.id,
      roleId: role!.id,
      role: "member",
    });
    return { userId: user!.id };
  },
  audit: (_input, output) => output,
});

/** A new org member holding `roleName` with the given till PIN. */
export async function memberWithPin(name: string, roleName: string, pin: string) {
  const { db, context } = databases();
  const { userId } = await addMember(db, context, { name, roleName });
  await devices.assignPin(principal, { userId, pin });
  return userId;
}
