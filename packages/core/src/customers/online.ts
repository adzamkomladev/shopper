import { and, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { customer } from "@shopper/db-pg";
import { readCustomerRow } from "./queries";

/**
 * Staff record that a customer agreed (or no longer agrees) to see their receipts and points in the online store
 * (v1.5 Day 51). An on-prem box publishes only these customers; switching off withdraws the copy on the next run.
 * Not a till field: the customer feed and sale events are unchanged.
 */
export const setCustomerOnline = defineCommand({
  name: "customer.online.set",
  async run(tx, ctx, input: { id: string; on: boolean }) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    await tx
      .update(customer)
      .set({
        // Switching on again keeps when they first agreed.
        onlineSharedAt: input.on ? sql`COALESCE(${customer.onlineSharedAt}, now())` : null,
        updatedAt: new Date(),
      })
      .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, current.id)));
    return { id: current.id, on: input.on };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({
    entity: "customer",
    entityId: output.id,
    after: { onlineShared: output.on },
  }),
});
