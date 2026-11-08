import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { taxRule, type ShopperTransaction } from "@shopper/db-pg";
import { ManagementError } from "../management";
import { affectedStores, recordChanges } from "../changes/record";
import { deleted, taxRulePayload, taxRuleUpsert } from "../changes/project";
import { taxPackRules, taxRuleInput } from "../schemas/tax/rules";
import { ghanaDate } from "../till/quotation";
import type { Queryable } from "../types";

/** Every dated rule of the org, the latest start first, in the shape tills receive. */
export async function listTaxRules(db: Queryable, orgId: string) {
  const rows = await db
    .select()
    .from(taxRule)
    .where(eq(taxRule.orgId, orgId))
    .orderBy(desc(taxRule.effectiveFrom));
  return rows.map(taxRulePayload);
}

/** Schedules a rule; it starts after today in Accra, so no sale already made can fall under it. */
export const createTaxRule = defineCommand({
  name: "tax.rule.create",
  async run(tx, ctx, input: { body: unknown; now?: Date }) {
    const body = scheduled(input.body, input.now);
    const [row] = await tx
      .insert(taxRule)
      .values({ orgId: ctx.orgId, ...body })
      .returning();
    return publish(tx, ctx.orgId, row!);
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "tax_rule", entityId: output.id, after: output }),
});

/** Changes a rule that has not started yet; a rule in force or past is history. */
export const updateTaxRule = defineCommand({
  name: "tax.rule.update",
  async run(tx, ctx, input: { id: string; body: unknown; now?: Date }) {
    const body = scheduled(input.body, input.now);
    const before = await notStarted(tx, ctx.orgId, input.id, input.now);
    const [row] = await tx
      .update(taxRule)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(taxRule.orgId, ctx.orgId), eq(taxRule.id, input.id)))
      .returning();
    return { before, after: await publish(tx, ctx.orgId, row!) };
  },
  audit: (_input, output) => ({ ...output }),
  details: (input, output) => ({
    entity: "tax_rule",
    entityId: input.id,
    before: output.before,
    after: output.after,
  }),
});

/** Removes a rule that has not started yet. */
export const deleteTaxRule = defineCommand({
  name: "tax.rule.delete",
  async run(tx, ctx, input: { id: string; now?: Date }) {
    const before = await notStarted(tx, ctx.orgId, input.id, input.now);
    await tx.delete(taxRule).where(and(eq(taxRule.orgId, ctx.orgId), eq(taxRule.id, input.id)));
    await recordChanges(
      tx,
      ctx.orgId,
      [deleted("tax-rule", input.id)],
      await affectedStores(tx, ctx.orgId),
    );
    return { before };
  },
  audit: (_input, output) => ({ ...output }),
  details: (input, output) => ({ entity: "tax_rule", entityId: input.id, before: output.before }),
});

/**
 * A tax rule pack Shopper signed from GRA's published rates, applied whatever the box's maintenance date: each rule the
 * shop does not have is scheduled, a scheduled one with other rates takes the pack's, and one that already matches is
 * left alone, so applying a pack twice changes nothing. Every rule must start after today: a day in force is history,
 * and one such rule refuses the whole pack.
 */
export const applyTaxPack = defineCommand({
  name: "tax.pack.apply",
  async run(tx, ctx, input: { version: string; rules: unknown; now?: Date }) {
    const rules = v.parse(taxPackRules, input.rules).map((rule) => scheduled(rule, input.now));
    const applied = [];
    for (const rule of rules) {
      const [existing] = await tx
        .select()
        .from(taxRule)
        .where(and(eq(taxRule.orgId, ctx.orgId), eq(taxRule.effectiveFrom, rule.effectiveFrom)))
        .for("update");
      if (
        existing &&
        Object.entries(rule).every(([key, value]) => existing[key as keyof typeof rule] === value)
      )
        continue;
      const [row] = existing
        ? await tx
            .update(taxRule)
            .set({ ...rule, updatedAt: new Date() })
            .where(and(eq(taxRule.orgId, ctx.orgId), eq(taxRule.id, existing.id)))
            .returning()
        : await tx
            .insert(taxRule)
            .values({ orgId: ctx.orgId, ...rule })
            .returning();
      applied.push(await publish(tx, ctx.orgId, row!));
    }
    return { version: input.version, applied };
  },
  audit: (_input, output) => ({ ...output }),
});

/** The rule in the body; it must start after today in Accra, so no sale already made falls under it. */
function scheduled(body: unknown, now = new Date()) {
  const rule = v.parse(taxRuleInput, body);
  if (rule.effectiveFrom <= ghanaDate(now))
    throw new ManagementError("A rule must start after today", 400);
  return rule;
}

async function notStarted(tx: ShopperTransaction, orgId: string, id: string, now = new Date()) {
  const [row] = await tx
    .select()
    .from(taxRule)
    .where(and(eq(taxRule.orgId, orgId), eq(taxRule.id, id)))
    .for("update");
  if (!row) throw new ManagementError("Tax rule not found", 404);
  if (row.effectiveFrom <= ghanaDate(now))
    throw new ManagementError("A rule in force or past cannot change", 409);
  return taxRulePayload(row);
}

async function publish(tx: ShopperTransaction, orgId: string, row: typeof taxRule.$inferSelect) {
  await recordChanges(tx, orgId, [taxRuleUpsert(row)], await affectedStores(tx, orgId));
  return taxRulePayload(row);
}
