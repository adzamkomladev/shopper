import { and, eq, gt, sql } from "drizzle-orm";
import { accountHold, type ShopperTransaction } from "@shopper/db-pg";
import { mulRatio, type Money } from "@shopper/money";
import { HOLD_TTL } from "../credit/account";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";
import { readLoyaltySettings } from "./settings";

/** Points other registers have set aside and not yet spent or released; a hold stops counting after an hour. */
export async function heldPoints(tx: ShopperTransaction, orgId: string, customerId: string) {
  const [{ held }] = (await tx
    .select({ held: sql<string>`COALESCE(SUM(${accountHold.points}), 0)::text` })
    .from(accountHold)
    .where(
      and(
        eq(accountHold.orgId, orgId),
        eq(accountHold.customerId, customerId),
        eq(accountHold.kind, "loyalty"),
        eq(accountHold.status, "held"),
        gt(accountHold.createdAt, sql`now() - ${HOLD_TTL}`),
      ),
    )) as [{ held: string }];
  return Number(held);
}

/** What a points tender is worth: whole points at the point value the hold was taken at. */
export const pointsValue = (points: number, pointValue: Money) => mulRatio(pointValue, points, 1);

/**
 * Checks that `points` can be set aside for a customer and the point value to hold them at. Takes the customer's row
 * lock, so two registers cannot both spend the last of them. LOYALTY_OFF while the org has loyalty off, POINTS_SHORT
 * (with the points still `available`) when other holds and the balance do not cover them.
 */
export async function takePoints(
  tx: ShopperTransaction,
  orgId: string,
  customerId: string,
  points: number,
) {
  const settings = await readLoyaltySettings(tx, orgId);
  if (!settings.enabled) throw new CustomerError("LOYALTY_OFF", "Loyalty is switched off");
  const current = await readCustomerRow(tx, orgId, customerId, true);
  if (current.archivedAt || current.mergedIntoId)
    throw new CustomerError("ARCHIVED", "The customer is archived");
  const available = Math.max(0, current.points - (await heldPoints(tx, orgId, current.id)));
  if (points > available)
    throw new CustomerError("POINTS_SHORT", "The customer has fewer points than that", {
      available,
    });
  return settings.pointValue;
}
