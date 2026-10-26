import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { account, member, role, user, type ShopperTransaction } from "@shopper/db-pg";
import type { cashierLoginInput } from "../schemas/devices";
import { minutes } from "./commands";
import type { Identity, Rejected } from "./types";

const invalid = "Invalid email or password";
/** Told only after the credential verifies, so it never reveals which accounts exist. */
export const deactivated = "Account deactivated";
// Verified against when the email is unknown, so both failures cost one scrypt run.
const decoy = hashPassword("decoy-password");

/** Resolves an org member by email and password, counting failures per user. */
export async function passwordIdentity(
  tx: ShopperTransaction,
  orgId: string,
  input: Extract<v.InferOutput<typeof cashierLoginInput>, { email: string }>,
): Promise<Identity | Rejected> {
  const [found] = await tx
    .select({
      id: user.id,
      name: user.name,
      attempts: user.passwordAttempts,
      lockedUntil: user.passwordLockedUntil,
      hash: account.password,
      roleId: role.id,
      roleName: role.name,
      deactivatedAt: member.deactivatedAt,
    })
    .from(user)
    .innerJoin(member, and(eq(member.orgId, user.orgId), eq(member.userId, user.id)))
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .leftJoin(
      account,
      and(
        eq(account.orgId, user.orgId),
        eq(account.userId, user.id),
        eq(account.providerId, "credential"),
      ),
    )
    .where(and(eq(user.orgId, orgId), sql`lower(${user.email}) = lower(${input.email})`))
    .for("update", { of: user });
  if (!found) {
    await verifyPassword({ hash: await decoy, password: input.password });
    return { error: invalid, status: 401 };
  }
  if (found.lockedUntil && found.lockedUntil > new Date())
    return {
      error: "Sign-in temporarily locked",
      status: 429,
      attempts: found.attempts,
      lockedUntil: found.lockedUntil.toISOString(),
    };
  const attempts = found.lockedUntil ? 0 : found.attempts;
  const hash = found.hash ?? (await decoy);
  if (!(await verifyPassword({ hash, password: input.password })) || !found.hash) {
    const lockedUntil = attempts + 1 >= 5 ? minutes(15) : null;
    await tx
      .update(user)
      .set({ passwordAttempts: attempts + 1, passwordLockedUntil: lockedUntil })
      .where(and(eq(user.orgId, orgId), eq(user.id, found.id)));
    return {
      error: invalid,
      status: 401,
      attempts: attempts + 1,
      lockedUntil: lockedUntil?.toISOString() ?? null,
    };
  }
  await tx
    .update(user)
    .set({ passwordAttempts: 0, passwordLockedUntil: null })
    .where(and(eq(user.orgId, orgId), eq(user.id, found.id)));
  if (found.deactivatedAt) return { error: deactivated, status: 403 };
  return { userId: found.id, name: found.name, roleId: found.roleId, roleName: found.roleName };
}
