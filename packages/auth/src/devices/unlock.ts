import * as v from "valibot";
import { and, eq, isNull, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { member, user } from "@shopper/db-pg";
import { grantedCodes } from "../roles/service";
import { clearLocks } from "../members/unlock";
import { memberBranchIds } from "../members/target";
import type { cashierUnlockInput } from "../schemas/devices";
import { pinIdentity } from "./login";

/**
 * A manager unlocks a cashier at the register with their own PIN. The device's credential is checked by the
 * service; refusals return (not throw) so the approver's counted failure is kept.
 */
export const registerUnlock = defineCommand({
  name: "cashier.unlock",
  async run(tx, c, input: v.InferOutput<typeof cashierUnlockInput>) {
    const approver = await pinIdentity(tx, c.orgId, { userId: input.approverId, pin: input.pin });
    if ("error" in approver) return approver;
    const atBranch = async (userId: string) => {
      const branches = await memberBranchIds(tx, c.orgId, userId);
      return !branches.length || branches.includes(c.branchId!);
    };
    const [grant] = await grantedCodes(tx, c.orgId, approver.userId, {
      code: "staff.unlock",
      deviceId: c.deviceId,
    }).limit(1);
    if (!grant || !(await atBranch(approver.userId)))
      return { error: "This person cannot unlock sign-in here", status: 403 as const };
    const [target] = await tx
      .select({ userId: user.id })
      .from(user)
      .innerJoin(member, and(eq(member.orgId, user.orgId), eq(member.userId, user.id)))
      .where(
        and(
          eq(user.orgId, c.orgId),
          sql`lower(${user.email}) = ${input.email.toLowerCase()}`,
          isNull(member.deactivatedAt),
        ),
      );
    if (!target || !(await atBranch(target.userId)))
      return { error: "No such cashier at this register", status: 404 as const };
    c.actorId = approver.userId.toLowerCase();
    c.role = approver.roleName;
    return {
      userId: target.userId,
      lockedUntil: null,
      change: await clearLocks(tx, c.orgId, target.userId),
    };
  },
  audit: (_input, result) => ({
    userId: "userId" in result ? result.userId : null,
    success: !("error" in result),
  }),
  details: (_input, result) =>
    "change" in result ? { entity: "user", entityId: result.userId, ...result.change } : {},
});
