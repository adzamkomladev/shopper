import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { org, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { paymentSettings } from "./schemas/settings";

/** Who collects the org's till MoMo. Payments already started keep the provider they began with. */
export async function readPaymentSettings(db: ShopperDatabase | ShopperTransaction, orgId: string) {
  const [row] = await db
    .select({ momoProvider: org.momoProvider })
    .from(org)
    .where(eq(org.id, orgId));
  if (!row) throw new Error("Org not found");
  return row;
}

export const setPaymentSettings = defineCommand({
  name: "payment.settings.set",
  async run(tx, ctx, input: { body: unknown }) {
    const next = v.parse(paymentSettings, input.body);
    const before = await readPaymentSettings(tx, ctx.orgId);
    await tx
      .update(org)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(org.id, ctx.orgId));
    return { before, after: next };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "org", before: output.before, after: output.after }),
});
