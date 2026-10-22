import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { loyaltyTier } from "@shopper/db-pg";
import { fromBigInt } from "@shopper/money";
import type { Queryable } from "../../types";

/** How far back spend counts towards a tier. */
const WINDOW = sql`interval '365 days'`;

/**
 * The tier a customer has earned as of `asOf`: the highest whose minimum their spend reached over the trailing 365
 * days, counting what customers merged into them spent and leaving out `exceptSaleId` (the sale being earned on).
 * Worked out each time and never stored. Null when no tier applies.
 */
// ponytail: spend is gross of refunds; net it with a refund join if returns should cost a customer their tier.
export async function tierFor(
  db: Queryable,
  orgId: string,
  customerId: string,
  asOf: Date,
  exceptSaleId?: string,
) {
  const { rows } = await db.execute<{ spend: string }>(sql`
    SELECT COALESCE(SUM(total), 0)::text AS spend FROM sale
    WHERE org_id = ${orgId}
      AND customer_id IN (SELECT id FROM customer WHERE org_id = ${orgId} AND (id = ${customerId} OR merged_into_id = ${customerId}))
      AND occurred_at <= ${asOf.toISOString()}::timestamptz
      AND occurred_at > ${asOf.toISOString()}::timestamptz - ${WINDOW}
      AND (${exceptSaleId ?? null}::uuid IS NULL OR id <> ${exceptSaleId ?? null}::uuid)`);
  const spend = fromBigInt(BigInt(rows[0]!.spend));
  const [tier] = await db
    .select()
    .from(loyaltyTier)
    .where(
      and(
        eq(loyaltyTier.orgId, orgId),
        isNull(loyaltyTier.archivedAt),
        lte(loyaltyTier.minSpend, spend),
        gt(loyaltyTier.earnBps, 0),
      ),
    )
    .orderBy(desc(loyaltyTier.minSpend), desc(loyaltyTier.earnBps))
    .limit(1);
  return tier ?? null;
}
