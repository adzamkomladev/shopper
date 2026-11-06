import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { branch, branchFulfilment } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { fulfilmentInput } from "../schemas/orders/fulfilment";
import type { Queryable } from "../types";
import { OrderError } from "./error";
import { readFulfilment } from "./slots";

/** What the form starts from for a branch nobody has set up: no online orders until pickup or delivery is turned on. */
export const defaultFulfilment = {
  pickup: false,
  delivery: false,
  deliveryFee: 0,
  opens: "08:00",
  closes: "20:00",
  slotMinutes: 60,
  slotCapacity: 10,
  leadMinutes: 60,
};

/** How a branch hands over online orders, or the default when it has never been set. */
export async function branchFulfilmentOf(db: Queryable, orgId: string, branchId: string) {
  await requireBranch(db, orgId, branchId);
  const row = await readFulfilment(db, orgId, branchId);
  if (!row) return defaultFulfilment;
  return {
    pickup: row.pickup,
    delivery: row.delivery,
    deliveryFee: row.deliveryFee as number,
    // PostgreSQL returns time as HH:MM:SS; the form edits HH:MM.
    opens: row.opens.slice(0, 5),
    closes: row.closes.slice(0, 5),
    slotMinutes: row.slotMinutes,
    slotCapacity: row.slotCapacity,
    leadMinutes: row.leadMinutes,
  };
}

/** Saves the branch's pickup, delivery, fee, hours and slots in one audited write. */
export const saveFulfilment = defineCommand({
  name: "branch.fulfilment_saved",
  async run(tx, context, input: { branchId: string; values: unknown }) {
    const values = v.parse(fulfilmentInput, input.values);
    await requireBranch(tx, context.orgId, input.branchId);
    const row = { ...values, deliveryFee: money(values.deliveryFee), updatedAt: new Date() };
    await tx
      .insert(branchFulfilment)
      .values({ orgId: context.orgId, branchId: input.branchId, ...row })
      .onConflictDoUpdate({
        target: [branchFulfilment.orgId, branchFulfilment.branchId],
        set: row,
      });
    return values;
  },
  audit: (input, output) => ({ branchId: input.branchId, ...output }),
  details: (input) => ({ entity: "branch", entityId: input.branchId }),
});

async function requireBranch(db: Queryable, orgId: string, branchId: string) {
  const [row] = await db
    .select({ id: branch.id })
    .from(branch)
    .where(and(eq(branch.orgId, orgId), eq(branch.id, branchId)));
  if (!row) throw new OrderError("not_found", "We could not find that branch");
}
