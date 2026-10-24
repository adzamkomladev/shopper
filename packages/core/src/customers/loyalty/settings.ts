import { and, asc, eq, isNull } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { loyaltyTier, org } from "@shopper/db-pg";
import { loyaltySettings, tierInput, tierPatch } from "../../schemas/customers/loyalty";
import { customerId } from "../../schemas/customers/inputs";
import type { Queryable } from "../../types";
import { CustomerError } from "../error";
import { wakeAccounts } from "../accounts/wake";

/** The org's loyalty settings; every org has them, off until a manager switches them on. */
export async function readLoyaltySettings(db: Queryable, orgId: string) {
  const [row] = await db
    .select({
      enabled: org.loyaltyEnabled,
      earnBps: org.loyaltyEarnBps,
      pointValue: org.loyaltyPointValue,
      expiryDays: org.loyaltyExpiryDays,
      tierNoticeDays: org.tierNoticeDays,
    })
    .from(org)
    .where(eq(org.id, orgId));
  return row!;
}

export const setLoyaltySettings = defineCommand({
  name: "loyalty.settings.set",
  async run(tx, ctx, input: { body: unknown }) {
    const next = v.parse(loyaltySettings, input.body);
    const before = await readLoyaltySettings(tx, ctx.orgId);
    await tx
      .update(org)
      .set({
        loyaltyEnabled: next.enabled,
        loyaltyEarnBps: next.earnBps,
        loyaltyPointValue: next.pointValue,
        loyaltyExpiryDays: next.expiryDays,
        tierNoticeDays: next.tierNoticeDays,
        updatedAt: new Date(),
      })
      .where(eq(org.id, ctx.orgId));
    wakeAccounts(tx, ctx.orgId);
    return { before, after: next };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({
    entity: "org",
    before: output.before,
    after: output.after,
  }),
});

type Tier = typeof loyaltyTier.$inferSelect;
/** The JSON a client sees. */
export const tierView = (row: Tier) => ({
  id: row.id,
  name: row.name,
  minSpend: row.minSpend,
  earnBps: row.earnBps,
  archivedAt: row.archivedAt?.toISOString() ?? null,
});

/** The tiers in play, lowest threshold first. */
export async function listTiers(db: Queryable, orgId: string) {
  const rows = await db
    .select()
    .from(loyaltyTier)
    .where(and(eq(loyaltyTier.orgId, orgId), isNull(loyaltyTier.archivedAt)))
    .orderBy(asc(loyaltyTier.minSpend), asc(loyaltyTier.id));
  return { items: rows.map(tierView) };
}

async function findTier(tx: Queryable, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(loyaltyTier)
    .where(and(eq(loyaltyTier.orgId, orgId), eq(loyaltyTier.id, v.parse(customerId, id))))
    .for("update");
  if (!row) throw new CustomerError("NOT_FOUND", "Tier not found");
  return row;
}

export const createTier = defineCommand({
  name: "loyalty.tier.create",
  async run(tx, ctx, input: { body: unknown }) {
    const tier = v.parse(tierInput, input.body);
    const [row] = await tx
      .insert(loyaltyTier)
      .values({ ...tier, orgId: ctx.orgId })
      .returning();
    return tierView(row!);
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "loyalty_tier", entityId: output.id }),
});

export const updateTier = defineCommand({
  name: "loyalty.tier.update",
  async run(tx, ctx, input: { id: string; body: unknown }) {
    const patch = v.parse(tierPatch, input.body);
    const before = await findTier(tx, ctx.orgId, input.id);
    const [row] = await tx
      .update(loyaltyTier)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(loyaltyTier.orgId, ctx.orgId), eq(loyaltyTier.id, before.id)))
      .returning();
    return { before: tierView(before), after: tierView(row!) };
  },
  audit: (_input, output) => ({ id: output.after.id, ...output }),
  details: (_input, output) => ({
    entity: "loyalty_tier",
    entityId: output.after.id,
    before: output.before,
    after: output.after,
  }),
});

/** Takes a tier out of play; archiving twice is the same as once. */
export const archiveTier = defineCommand({
  name: "loyalty.tier.archive",
  async run(tx, ctx, input: { id: string }) {
    const current = await findTier(tx, ctx.orgId, input.id);
    if (current.archivedAt) return tierView(current);
    const [row] = await tx
      .update(loyaltyTier)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(loyaltyTier.orgId, ctx.orgId), eq(loyaltyTier.id, current.id)))
      .returning();
    return tierView(row!);
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "loyalty_tier", entityId: output.id }),
});
