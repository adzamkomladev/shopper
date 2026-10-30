import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { cashierPin, user, type ShopperTransaction } from "@shopper/db-pg";
import { manageable } from "./target";

/** A member's PIN and password lockouts, lifted from the back office by someone holding staff.unlock. */
export const unlockMember = defineCommand({
  name: "auth.member.unlock",
  async run(tx, context, rawUserId: string) {
    const target = await manageable(tx, context, rawUserId, "staff.unlock");
    return {
      userId: target.userId,
      lockedUntil: null,
      change: await clearLocks(tx, context.orgId, target.userId),
    };
  },
  audit: (_input, output) => ({ userId: output.userId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, ...output.change }),
});

/**
 * Lifts both lockouts before they lapse and forgets the failures that led there; the credentials stay as they
 * were. Returns the counts before and after for the audit row (named so the audit's secret filter keeps them).
 */
export async function clearLocks(tx: ShopperTransaction, orgId: string, userId: string) {
  const ofUser = and(eq(user.orgId, orgId), eq(user.id, userId));
  const ofPin = and(eq(cashierPin.orgId, orgId), eq(cashierPin.userId, userId));
  const [password] = await tx
    .select({ attempts: user.passwordAttempts, lockedUntil: user.passwordLockedUntil })
    .from(user)
    .where(ofUser)
    .for("update");
  const [pin] = await tx
    .select({ attempts: cashierPin.attempts, lockedUntil: cashierPin.lockedUntil })
    .from(cashierPin)
    .where(ofPin)
    .for("update");
  await tx.update(user).set({ passwordAttempts: 0, passwordLockedUntil: null }).where(ofUser);
  await tx.update(cashierPin).set({ attempts: 0, lockedUntil: null }).where(ofPin);
  return {
    before: {
      codeFailures: pin?.attempts ?? 0,
      codeLockedUntil: pin?.lockedUntil?.toISOString() ?? null,
      signInFailures: password?.attempts ?? 0,
      signInLockedUntil: password?.lockedUntil?.toISOString() ?? null,
    },
    after: { codeFailures: 0, codeLockedUntil: null, signInFailures: 0, signInLockedUntil: null },
  };
}
