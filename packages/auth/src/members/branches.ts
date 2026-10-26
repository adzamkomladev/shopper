import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { branch, cashierSession, memberBranch } from "@shopper/db-pg";
import { AdministrationError } from "../roles/service";
import { memberBranchesInput } from "../schemas/users";
import { assertWithin, manageable } from "./target";

/**
 * Limits a member to some branches, or (an empty list) lifts the limit. The owner always works everywhere, and a
 * branch-scoped actor grants only inside their own branches.
 */
export const setMemberBranches = defineCommand({
  name: "auth.member.branches.set",
  async run(tx, context, input: { userId: string; data: unknown }) {
    const { branchIds: requested } = v.parse(memberBranchesInput, input.data);
    const target = await manageable(tx, context, input.userId, "role.write");
    const branchIds = [...new Set(requested.map((id) => id.toLowerCase()))].sort();
    if (target.protectedOwner && branchIds.length)
      throw new AdministrationError("The owner works at every branch", 409);
    if (target.actorScope.length) assertWithin(target.actorScope, branchIds);
    const found = branchIds.length
      ? await tx
          .select({ id: branch.id })
          .from(branch)
          .where(and(eq(branch.orgId, context.orgId), inArray(branch.id, branchIds)))
      : [];
    if (found.length !== branchIds.length)
      throw new AdministrationError("Branch not found in this organization", 404);
    await tx
      .delete(memberBranch)
      .where(
        and(eq(memberBranch.orgId, context.orgId), eq(memberBranch.memberId, target.memberId)),
      );
    if (branchIds.length)
      await tx.insert(memberBranch).values(
        branchIds.map((branchId) => ({
          orgId: context.orgId,
          memberId: target.memberId,
          branchId,
        })),
      );
    // Till sessions open at a branch now out of scope end here; cut, like deactivation, so earlier sales upload.
    if (branchIds.length)
      await tx
        .update(cashierSession)
        .set({ expiresAt: sql`least(${cashierSession.expiresAt}, now())` })
        .where(
          and(
            eq(cashierSession.orgId, context.orgId),
            eq(cashierSession.userId, target.userId),
            isNull(cashierSession.revokedAt),
            notInArray(cashierSession.branchId, branchIds),
          ),
        );
    return {
      userId: target.userId,
      branchIds,
      change: { before: { branchIds: target.branchIds }, after: { branchIds } },
    };
  },
  audit: (_input, output) => ({ userId: output.userId, branchIds: output.branchIds }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, ...output.change }),
});
