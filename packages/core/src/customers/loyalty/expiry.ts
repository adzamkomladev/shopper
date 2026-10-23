import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { loyaltyEntry, type ShopperTransaction } from "@shopper/db-pg";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";
import { lotExpiry, pointLots } from "./points";
import { readLoyaltySettings } from "./settings";

type Input = { customerId: string; at: Date };

/**
 * Lapses every earn lot older than `loyalty_expiry_days` at `at`: one `expire` entry per lot for what spending left
 * of it, dated when the lot lapsed. The ledger allows one expiry per lot, so running it again posts nothing.
 */
export const expirePoints = defineCommand({
  name: "loyalty.expire",
  async replay(tx, ctx, input: Input) {
    const due = await dueLots(tx, ctx, input);
    return due.lots.length === 0
      ? { output: { customerId: due.customerId, expired: [] } }
      : undefined;
  },
  async run(tx, ctx, input) {
    const { customerId, lots, expiryDays } = await dueLots(tx, ctx, input);
    for (const lot of lots)
      await tx.insert(loyaltyEntry).values({
        orgId: ctx.orgId,
        customerId,
        reason: "expire",
        points: -lot.left,
        lotId: lot.id,
        occurredAt: lotExpiry(lot, expiryDays),
      });
    return { customerId, expired: lots.map((lot) => ({ lotId: lot.id, points: lot.left })) };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});

/** A customer's points entries, for the pure lot sums. */
export async function pointsEntries(db: Queryable, orgId: string, customerId: string) {
  return db
    .select({
      id: loyaltyEntry.id,
      reason: loyaltyEntry.reason,
      points: loyaltyEntry.points,
      occurredAt: loyaltyEntry.occurredAt,
      lotId: loyaltyEntry.lotId,
    })
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.orgId, orgId), eq(loyaltyEntry.customerId, customerId)));
}

async function dueLots(tx: ShopperTransaction, ctx: CommandContext, input: Input) {
  const current = await readCustomerRow(tx, ctx.orgId, input.customerId, true);
  const { enabled, expiryDays } = await readLoyaltySettings(tx, ctx.orgId);
  if (!enabled || expiryDays === 0) return { customerId: current.id, lots: [], expiryDays };
  const lots = pointLots(await pointsEntries(tx, ctx.orgId, current.id)).filter(
    (lot) => lot.left > 0 && lotExpiry(lot, expiryDays) <= input.at,
  );
  return { customerId: current.id, lots, expiryDays };
}
