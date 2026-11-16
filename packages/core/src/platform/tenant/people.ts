import { asc, desc, eq } from "drizzle-orm";
import { invitation, member, role, user, type ShopperDatabase } from "@shopper/db-pg";

/** The shop's members with their roles, the owner among them, and its invitations, newest first. */
export async function tenantStaff(db: ShopperDatabase, orgId: string) {
  const [members, invitations] = await Promise.all([
    db
      .select({
        id: member.id,
        name: user.name,
        email: user.email,
        role: role.name,
        owner: role.protectedOwner,
        deactivatedAt: member.deactivatedAt,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .innerJoin(role, eq(role.id, member.roleId))
      .where(eq(member.orgId, orgId))
      .orderBy(asc(member.createdAt))
      .limit(500),
    db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: role.name,
        status: invitation.status,
        channel: invitation.channel,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .leftJoin(role, eq(role.id, invitation.roleId))
      .where(eq(invitation.orgId, orgId))
      .orderBy(desc(invitation.createdAt))
      .limit(100),
  ]);
  const owner = members.find((row) => row.owner && !row.deactivatedAt);
  return {
    owner: owner ? { name: owner.name, email: owner.email } : null,
    members: members.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      owner: row.owner,
      active: !row.deactivatedAt,
      createdAt: row.createdAt.toISOString(),
    })),
    invitations: invitations.map((row) => ({
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
