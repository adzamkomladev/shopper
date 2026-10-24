import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { org } from "@shopper/db-pg";
import { taxSettings, type TaxSettings } from "../schemas/tax/settings";
import { affectedStores, recordChanges } from "../changes/record";
import { orgSettingUpsert } from "../changes/project";
import type { Queryable } from "../types";

/** The org's TIN, VAT registration date, price mode and cash rounding. */
export async function readTaxSettings(db: Queryable, orgId: string): Promise<TaxSettings> {
  const [row] = await db
    .select({
      tin: org.tin,
      vatRegisteredFrom: org.vatRegisteredFrom,
      priceMode: org.priceMode,
      cashRounding: org.cashRounding,
    })
    .from(org)
    .where(eq(org.id, orgId));
  return row!;
}

/** Replaces the tax settings; every store's tills get them as one org-setting change. */
export const setTaxSettings = defineCommand({
  name: "tax.settings.set",
  async run(tx, ctx, input: { body: unknown }) {
    const next = v.parse(taxSettings, input.body);
    const before = await readTaxSettings(tx, ctx.orgId);
    await tx
      .update(org)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(org.id, ctx.orgId));
    await recordChanges(
      tx,
      ctx.orgId,
      [orgSettingUpsert(ctx.orgId, next)],
      await affectedStores(tx, ctx.orgId),
    );
    return { before, after: next };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "org", before: output.before, after: output.after }),
});
