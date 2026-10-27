import { eq } from "drizzle-orm";
import { subscription, type ShopperDatabase } from "@shopper/db-pg";

/** Days after a period starts that its unpaid invoice turns the back office read-only. */
export const READ_ONLY_AFTER_DAYS = 14;

/** One billing period's workflow instance: the org and the day the period starts. */
export const billingId = (orgId: string, periodStart: string) => `billing-${orgId}-${periodStart}`;

/** True when an unpaid invoice has turned the org's back office read-only; an org without a subscription never is. */
export async function isReadOnly(db: ShopperDatabase, orgId: string) {
  const [row] = await db
    .select({ status: subscription.status })
    .from(subscription)
    .where(eq(subscription.orgId, orgId));
  return row?.status === "read_only";
}
