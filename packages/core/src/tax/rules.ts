import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { taxRule, type ShopperTransaction } from "@shopper/db-pg";
import { ManagementError } from "../management";
import { affectedStores, recordChanges } from "../changes/record";
import { deleted, taxRulePayload, taxRuleUpsert } from "../changes/project";
import { scheduledRule } from "../schemas/tax/rules";
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
    const body = v.parse(scheduledRule(ghanaDate(input.now ?? new Date())), input.body);
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
    const body = v.parse(scheduledRule(ghanaDate(input.now ?? new Date())), input.body);
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
