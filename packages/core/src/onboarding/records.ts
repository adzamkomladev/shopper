import { and, eq, isNull } from "drizzle-orm";
import { v7 } from "uuid";
import { enqueueAfterCommit } from "@shopper/audit";
import { onboarding, type ShopperTransaction } from "@shopper/db-pg";
import type { onboardingMarks } from "./schemas/base";

/** The onboarding workflow's instance: one per shop, keyed by the org id it was given at signup. */
export const onboardingId = (orgId: string) => `onboarding-${orgId}`;

/** The event type that wakes the workflow; the row it then reads says what happened. */
export const ONBOARDING_WAKE = "wake";

/**
 * Stamps the shop's first product or first sale inside the command that made it, and wakes the workflow once that
 * transaction commits. Only the first stamp counts: the row lock makes concurrent first sales agree on one, and it
 * answers true for that one alone. A shop with no onboarding row (a box, or one made before Day 25) marks nothing.
 */
export async function markOnboarding(
  tx: ShopperTransaction,
  orgId: string,
  mark: (typeof onboardingMarks)[number],
) {
  const at = new Date();
  const [stamped] = await tx
    .update(onboarding)
    .set(
      mark === "catalogue"
        ? { catalogueAt: at, updatedAt: at }
        : { firstSaleAt: at, status: "trading", updatedAt: at },
    )
    .where(
      and(
        eq(onboarding.orgId, orgId),
        isNull(mark === "catalogue" ? onboarding.catalogueAt : onboarding.firstSaleAt),
      ),
    )
    .returning({ id: onboarding.id });
  if (!stamped) return false;
  enqueueAfterCommit(tx, {
    id: v7(),
    orgId,
    v: 1,
    sequence: "0",
    type: "onboarding.event",
    payload: { mark },
  });
  return true;
}

/** Creates the shop's onboarding row with the org; provisioning a second time leaves the first. */
export async function openOnboarding(tx: ShopperTransaction, orgId: string) {
  await tx.insert(onboarding).values({ orgId }).onConflictDoNothing({ target: onboarding.orgId });
}

/** Locks and reads the row a step decides on. */
export async function lockOnboarding(tx: ShopperTransaction, orgId: string) {
  const [row] = await tx.select().from(onboarding).where(eq(onboarding.orgId, orgId)).for("update");
  if (!row) throw new Error("Onboarding row not found");
  return row;
}
