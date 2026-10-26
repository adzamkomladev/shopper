import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { cashierSession, member, role, session } from "@shopper/db-pg";
import { AdministrationError } from "../roles/service";
import { manageable } from "./target";

/**
 * Stops a member signing in or acting anywhere: their portal sessions end and their live till sessions are cut
 * to now. Cut, not revoked, so sales they made before this moment still upload with their historical authority.
 */
export const deactivateMember = defineCommand({
  name: "auth.member.deactivate",
  async run(tx, context, rawUserId: string) {
    const target = await manageable(tx, context, rawUserId, "user.write");
    if (target.userId === context.actorId)
      throw new AdministrationError("You can't deactivate yourself", 409);
    if (target.protectedOwner && !target.deactivatedAt) {
      const [other] = await tx
        .select({ id: member.id })
        .from(member)
        .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
        .where(
          and(
            eq(member.orgId, context.orgId),
            eq(role.protectedOwner, true),
            isNull(member.deactivatedAt),
            ne(member.userId, target.userId),
          ),
        )
        .limit(1);
      if (!other) throw new AdministrationError("The last owner cannot be deactivated", 409);
    }
    const at = target.deactivatedAt ?? new Date();
    await tx
      .update(member)
      .set({ deactivatedAt: at })
      .where(and(eq(member.orgId, context.orgId), eq(member.id, target.memberId)));
    await tx
      .delete(session)
      .where(and(eq(session.orgId, context.orgId), eq(session.userId, target.userId)));
    await tx
      .update(cashierSession)
      .set({ expiresAt: sql`least(${cashierSession.expiresAt}, ${at})` })
      .where(
        and(
          eq(cashierSession.orgId, context.orgId),
          eq(cashierSession.userId, target.userId),
          isNull(cashierSession.revokedAt),
        ),
      );
    return status(target, at);
  },
  audit: (_input, output) => ({ userId: output.userId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, ...output.change }),
});

export const reactivateMember = defineCommand({
  name: "auth.member.reactivate",
  async run(tx, context, rawUserId: string) {
    const target = await manageable(tx, context, rawUserId, "user.write");
    await tx
      .update(member)
      .set({ deactivatedAt: null })
      .where(and(eq(member.orgId, context.orgId), eq(member.id, target.memberId)));
    return status(target, null);
  },
  audit: (_input, output) => ({ userId: output.userId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, ...output.change }),
});

const status = (target: { userId: string; deactivatedAt: Date | null }, at: Date | null) => ({
  userId: target.userId,
  deactivatedAt: at?.toISOString() ?? null,
  change: {
    before: { deactivatedAt: target.deactivatedAt?.toISOString() ?? null },
    after: { deactivatedAt: at?.toISOString() ?? null },
  },
});
