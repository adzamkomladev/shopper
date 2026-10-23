import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { loyaltyTier } from "@shopper/db-pg";
import { add, fromBigInt, money, sub, type Money } from "@shopper/money";
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

const YEAR = 365 * 86_400_000;
type Tier = typeof loyaltyTier.$inferSelect;
type Spend = { total: Money; occurredAt: Date };

/**
 * Pure: assuming no new sales, when the customer's tier at `asOf` is lost, as each sale leaves the trailing 365 days,
 * and the tier they fall to (null for none). Null when they hold no tier.
 */
export function tierProjection(sales: readonly Spend[], tiers: readonly Tier[], asOf: Date) {
  const live = sales
    .filter((s) => s.occurredAt <= asOf && s.occurredAt.getTime() > asOf.getTime() - YEAR)
    .sort((a, b) => a.occurredAt.valueOf() - b.occurredAt.valueOf());
  let spend = live.reduce((sum, s) => add(sum, s.total), money(0));
  const from = tierAt(tiers, spend);
  if (!from) return null;
  for (const sale of live) {
    spend = sub(spend, sale.total);
    if (spend < from.minSpend)
      return { from, to: tierAt(tiers, spend), on: new Date(sale.occurredAt.getTime() + YEAR) };
  }
  return null;
}

/** `tierProjection` over the customer's sales (and those of customers merged into them) and the org's tiers. */
export async function readTierProjection(
  db: Queryable,
  orgId: string,
  customerId: string,
  asOf: Date,
) {
  const tiers = await db
    .select()
    .from(loyaltyTier)
    .where(
      and(eq(loyaltyTier.orgId, orgId), isNull(loyaltyTier.archivedAt), gt(loyaltyTier.earnBps, 0)),
    );
  if (tiers.length === 0) return null;
  const { rows } = await db.execute<{ total: string; ms: string }>(sql`
    SELECT COALESCE(total, 0)::text AS total, (extract(epoch FROM occurred_at) * 1000)::bigint::text AS ms FROM sale
    WHERE org_id = ${orgId}
      AND customer_id IN (SELECT id FROM customer WHERE org_id = ${orgId} AND (id = ${customerId} OR merged_into_id = ${customerId}))
      AND occurred_at <= ${asOf.toISOString()}::timestamptz
      AND occurred_at > ${asOf.toISOString()}::timestamptz - ${WINDOW}`);
  const sales = rows.map((row) => ({
    total: fromBigInt(BigInt(row.total)),
    occurredAt: new Date(Number(row.ms)),
  }));
  return tierProjection(sales, tiers, asOf);
}

/** The highest tier `spend` reaches, as `tierFor` picks it. */
function tierAt(tiers: readonly Tier[], spend: Money) {
  return (
    [...tiers]
      .filter((tier) => tier.earnBps > 0 && tier.minSpend <= spend)
      .sort((a, b) => b.minSpend - a.minSpend || b.earnBps - a.earnBps)[0] ?? null
  );
}
