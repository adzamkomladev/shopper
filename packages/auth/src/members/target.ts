import { and, eq, exists, notExists, or, type SQL } from "drizzle-orm";
import * as v from "valibot";
import type { CommandContext } from "@shopper/audit";
import { member, memberBranch, role, type ShopperTransaction } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { AdministrationError, assertCanGrantRole, assertHasPermission } from "../roles/service";

type Reader = Pick<ShopperTransaction, "select">;

/**
 * The target's membership, once the actor may manage it: `code`, every permission its role holds (unless `rank` is
 * false, for an action that hands out no role), and (for a branch-scoped actor) a target scoped inside the actor's
 * own branches.
 */
export async function manageable(
  tx: ShopperTransaction,
  context: CommandContext,
  rawUserId: string,
  code: string,
  rank = true,
) {
  const userId = v.parse(uuidV7Schema, rawUserId).toLowerCase();
  await assertHasPermission(tx, context, code);
  const [target] = await tx
    .select({
      memberId: member.id,
      userId: member.userId,
      roleId: member.roleId,
      protectedOwner: role.protectedOwner,
      deactivatedAt: member.deactivatedAt,
    })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .where(and(eq(member.orgId, context.orgId), eq(member.userId, userId)))
    .for("update", { of: member });
  if (!target) throw new AdministrationError("User not found in this organization", 404);
  if (rank) await assertCanGrantRole(tx, context, target.roleId);
  const branchIds = await memberBranchIds(tx, context.orgId, target.userId);
  const actorScope = await memberBranchIds(tx, context.orgId, context.actorId!);
  if (actorScope.length) assertWithin(actorScope, branchIds);
  return { ...target, branchIds, actorScope };
}

/** The branches a member is limited to, sorted; empty means every branch. */
export async function memberBranchIds(db: Reader, orgId: string, userId: string) {
  const rows = await db
    .select({ branchId: memberBranch.branchId })
    .from(memberBranch)
    .innerJoin(
      member,
      and(eq(member.orgId, memberBranch.orgId), eq(member.id, memberBranch.memberId)),
    )
    .where(and(eq(memberBranch.orgId, orgId), eq(member.userId, userId)));
  return rows.map((row) => row.branchId).sort();
}

/** Refuses a branch set that reaches past a scoped actor's own branches; an empty set means every branch. */
export function assertWithin(actorScope: string[], branchIds: string[]) {
  if (!branchIds.length || branchIds.some((id) => !actorScope.includes(id)))
    throw new AdministrationError("That reaches branches outside your own", 403);
}

/** A `member` row allowed at `branchId`: unscoped, or scoped to include it. */
export function atBranch(db: Reader, branchId: string): SQL {
  const scoped = (extra?: SQL) =>
    db
      .select({ id: memberBranch.id })
      .from(memberBranch)
      .where(
        and(eq(memberBranch.orgId, member.orgId), eq(memberBranch.memberId, member.id), extra),
      );
  return or(notExists(scoped()), exists(scoped(eq(memberBranch.branchId, branchId))))!;
}
