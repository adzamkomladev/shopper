import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { org } from "@shopper/db-pg";
import { creditSettings } from "../../schemas/customers/credit";
import type { Queryable } from "../../types";
import { wakeAccounts } from "../accounts/wake";

/** The org's credit settings: terms in days, and the monthly interest rate in bps (0 is off). */
export async function readCreditSettings(db: Queryable, orgId: string) {
  const [row] = await db
    .select({ termsDays: org.creditTermsDays, interestBps: org.creditInterestBps })
    .from(org)
    .where(eq(org.id, orgId));
  return row!;
}

/** Changes the terms and the interest rate; every account is woken to find its new due date. */
export const setCreditSettings = defineCommand({
  name: "credit.settings.set",
  async run(tx, ctx, input: { body: unknown }) {
    const next = v.parse(creditSettings, input.body);
    const before = await readCreditSettings(tx, ctx.orgId);
    await tx
      .update(org)
      .set({
        creditTermsDays: next.termsDays,
        creditInterestBps: next.interestBps,
        updatedAt: new Date(),
      })
      .where(eq(org.id, ctx.orgId));
    wakeAccounts(tx, ctx.orgId);
    return { before, after: next };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "org", before: output.before, after: output.after }),
});
