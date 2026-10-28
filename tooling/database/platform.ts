import { eq } from "drizzle-orm";
import { createVerifiedOwner } from "../../packages/auth/src/onboarding/owner";
import { seedPlatformRoles } from "../../packages/auth/src/roles/platform";
import { org, type ShopperDatabase } from "../../packages/db/pg/src/index";
import { provisionOrg, provisioningContext } from "./seed";

/** The admin app's org code in dev and e2e; staging sets its own `SHOPPER_PLATFORM_ORG`. */
export const PLATFORM_ORG = "shopper";

/**
 * The org whose members are Shopper staff, with one owner holding the platform permissions. It is an org like any
 * shop's, so its staff sign in with the same Better Auth session; only the platform API tells them apart.
 */
export async function seedPlatform(db: ShopperDatabase, email: string, password: string) {
  const [existing] = await db.select({ id: org.id }).from(org).where(eq(org.slug, PLATFORM_ORG));
  if (existing) return { id: existing.id, created: false };
  const context = provisioningContext();
  await provisionOrg(db, context, { name: "Shopper", slug: PLATFORM_ORG });
  await createVerifiedOwner(db, context, { name: "Shopper staff", email, password });
  await seedPlatformRoles(db, context, undefined);
  return { id: context.orgId, created: true };
}
