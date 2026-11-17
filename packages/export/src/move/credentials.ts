import { and, eq, isNotNull } from "drizzle-orm";
import {
  account,
  cashierPin,
  sessionKey,
  type MoveCredentials,
  type ShopperDatabase,
} from "@shopper/db-pg";

/** What the archive leaves out so that people sign in, unlock and prove sessions as before wherever the shop moves. */
export async function credentials(db: ShopperDatabase, orgId: string): Promise<MoveCredentials> {
  const passwords = await db
    .select({ userId: account.userId, password: account.password })
    .from(account)
    .where(
      and(
        eq(account.orgId, orgId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    );
  const pins = await db
    .select({ userId: cashierPin.userId, pinHash: cashierPin.pinHash })
    .from(cashierPin)
    .where(eq(cashierPin.orgId, orgId));
  const [key] = await db.select().from(sessionKey).where(eq(sessionKey.orgId, orgId));
  return {
    passwords: passwords.map((row) => ({ userId: row.userId, password: row.password! })),
    pins,
    sessionKey: key?.key ?? null,
  };
}
