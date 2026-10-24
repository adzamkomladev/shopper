import { and, eq, sql } from "drizzle-orm";
import { loyaltyEntry, saleTender, type ShopperTransaction } from "@shopper/db-pg";
import type { CommandContext } from "@shopper/audit";
import { add, fromBigInt, money, sub, type Money } from "@shopper/money";
import type { SaleSnapshot } from "../../schemas/till/sale";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";
import { currentCustomerId } from "../sale";
import { wakeAccount } from "../accounts/wake";
import { pointsEarned, pointsReversed } from "./points";
import { readLoyaltySettings, tierView } from "./settings";
import { readTierProjection, tierFor } from "./tiers";

/**
 * Credits the points a sale earned its customer, once (the ledger allows one earn per sale): the share paid in money,
 * not the share paid in points, at the customer's tier rate or the org's, and the entry keeps the rate and the point
 * value it used. Nothing while loyalty is off. Runs after the sale row is written; answers the points earned.
 */
export async function earnPoints(
  tx: ShopperTransaction,
  ctx: CommandContext,
  input: { snapshot: SaleSnapshot; customerId: string | null; occurredAt: Date },
) {
  const { snapshot, customerId, occurredAt } = input;
  if (!customerId) return 0;
  const settings = await readLoyaltySettings(tx, ctx.orgId);
  if (!settings.enabled) return 0;
  const redeemed = snapshot.tenders
    .filter((tender) => tender.kind === "loyalty")
    .reduce((sum, tender) => add(sum, tender.amount), money(0));
  const tier = await tierFor(tx, ctx.orgId, customerId, occurredAt, snapshot.id);
  const rateBps = tier?.earnBps ?? settings.earnBps;
  const points = pointsEarned(sub(snapshot.total, redeemed), rateBps, settings.pointValue);
  if (points === 0) return 0;
  await tx.insert(loyaltyEntry).values({
    orgId: ctx.orgId,
    customerId,
    reason: "earn",
    points,
    saleId: snapshot.id,
    rateBps,
    pointValue: settings.pointValue,
    actorId: snapshot.cashierId,
    occurredAt,
  });
  return points;
}

/** What the ledger holds about the points of one sale: its earn, its redeem and what refunds have moved since. */
export async function salePoints(tx: ShopperTransaction, orgId: string, saleId: string) {
  const rows = await tx
    .select()
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.orgId, orgId), eq(loyaltyEntry.saleId, saleId)))
    .orderBy(loyaltyEntry.id);
  const earn = rows.find((row) => row.reason === "earn");
  const redeem = rows.find((row) => row.reason === "redeem");
  const reversals = rows.filter((row) => row.reason === "reverse");
  let redeemed: { customerId: string; points: number; value: Money } | null = null;
  if (redeem) {
    const [tender] = await tx
      .select({ amount: saleTender.amount })
      .from(saleTender)
      .where(
        and(
          eq(saleTender.orgId, orgId),
          eq(saleTender.saleId, saleId),
          eq(saleTender.kind, "loyalty"),
        ),
      );
    redeemed = { customerId: redeem.customerId, points: -redeem.points, value: tender!.amount };
  }
  return {
    earn,
    redeemed,
    /** Points of the earn no refund has taken back yet. */
    unreversed: earn
      ? earn.points + reversals.filter((r) => r.points < 0).reduce((n, r) => n + r.points, 0)
      : 0,
    /** Redeemed points refunds have already handed back. */
    returned: reversals.filter((r) => r.points > 0).reduce((n, r) => n + r.points, 0),
  };
}

type Settled = Awaited<ReturnType<typeof salePoints>>;

/**
 * The ledger side of an accepted refund: the redeemed points it hands back (first), then the earn it reverses at the
 * rate the earn stored, capped at what is left of it. Both go to the customer the sale was rung up to, or to the
 * winner when that customer was merged away; each customer whose points moved has their account workflow woken.
 */
export async function settleRefundPoints(
  tx: ShopperTransaction,
  ctx: CommandContext,
  input: {
    held: Settled;
    /** The refund's gross less the redeemed points it hands back: the earn reverses on money only. */
    paid: Money;
    returned: number;
    refundId: string;
    saleId: string;
    actorId: string;
    occurredAt: Date;
  },
) {
  const { held } = input;
  const entry = {
    orgId: ctx.orgId,
    reason: "reverse" as const,
    saleId: input.saleId,
    refundId: input.refundId,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
  };
  const moved = new Set<string>();
  const put = async (customerId: string, points: number) => {
    const id = await currentCustomerId(tx, ctx.orgId, customerId);
    await tx.insert(loyaltyEntry).values({ ...entry, customerId: id, points });
    moved.add(id);
  };
  if (input.returned > 0 && held.redeemed) await put(held.redeemed.customerId, input.returned);
  if (held.earn) {
    const reversed = pointsReversed(
      input.paid,
      { rateBps: held.earn.rateBps!, pointValue: held.earn.pointValue! },
      held.unreversed,
    );
    if (reversed > 0) await put(held.earn.customerId, -reversed);
  }
  for (const id of moved) wakeAccount(tx, ctx.orgId, id);
}

/** A customer's points with a running balance after each entry, and the tier they would earn at now. */
export async function readLoyalty(db: Queryable, orgId: string, id: string) {
  const current = await readCustomerRow(db, orgId, id);
  const { rows } = await db.execute<{
    id: string;
    reason: string;
    points: number;
    balance: string;
    sale_id: string | null;
    refund_id: string | null;
    rate_bps: number | null;
    occurred_at: string;
  }>(sql`
    SELECT id, reason, points, sale_id, refund_id, rate_bps,
      to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      SUM(points) OVER (ORDER BY occurred_at, id)::text AS balance
    FROM loyalty_entry WHERE org_id = ${orgId} AND customer_id = ${current.id}
    ORDER BY occurred_at, id`);
  const settings = await readLoyaltySettings(db, orgId);
  const now = new Date();
  const tier = settings.enabled ? await tierFor(db, orgId, current.id, now) : null;
  const moving = settings.enabled ? await readTierProjection(db, orgId, current.id, now) : null;
  return {
    customerId: current.id,
    points: current.points,
    enabled: settings.enabled,
    tier: tier && tierView(tier),
    /** The tier they lose and the day, assuming no new sales; null while they keep it. */
    projection: moving && {
      from: moving.from.name,
      to: moving.to?.name ?? null,
      on: moving.on.toISOString(),
    },
    entries: rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      points: Number(row.points),
      balance: Number(fromBigInt(BigInt(row.balance))),
      saleId: row.sale_id,
      refundId: row.refund_id,
      rateBps: row.rate_bps,
      occurredAt: row.occurred_at,
    })),
  };
}
