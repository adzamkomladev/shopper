import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { loyaltyEntry } from "@shopper/db-pg";
import { transferInput } from "../../schemas/customers/loyalty";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";
import { heldPoints } from "./holds";
import { readLoyaltySettings } from "./settings";

/**
 * Moves points from one customer to another as a pair of `transfer` entries, so both folds change and the org's
 * total does not. Points held for a sale are already spent. Needs loyalty on and two open, different customers.
 */
export const transferPoints = defineCommand({
  name: "loyalty.transfer",
  async run(tx, ctx, input: { body: unknown }) {
    const { fromId, toId, points, reason } = v.parse(transferInput, input.body);
    if (fromId === toId) throw new CustomerError("SAME_CUSTOMER", "Choose two different customers");
    if (!(await readLoyaltySettings(tx, ctx.orgId)).enabled)
      throw new CustomerError("LOYALTY_OFF", "Loyalty is switched off");
    // Lock in id order, so two opposite transfers cannot wait on each other.
    const [first, second] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const rows = new Map([
      [first, await readCustomerRow(tx, ctx.orgId, first, true)],
      [second, await readCustomerRow(tx, ctx.orgId, second, true)],
    ]);
    const [from, to] = [rows.get(fromId)!, rows.get(toId)!];
    if (from.archivedAt || from.mergedIntoId || to.archivedAt || to.mergedIntoId)
      throw new CustomerError("ARCHIVED", "An archived customer cannot send or receive points");
    const available = Math.max(0, from.points - (await heldPoints(tx, ctx.orgId, from.id)));
    if (points > available)
      throw new CustomerError("POINTS_SHORT", "The customer has fewer points than that", {
        available,
      });
    const entry = {
      orgId: ctx.orgId,
      reason: "transfer" as const,
      actorId: ctx.actorId,
      occurredAt: new Date(),
    };
    await tx.insert(loyaltyEntry).values([
      { ...entry, customerId: from.id, points: -points },
      { ...entry, customerId: to.id, points },
    ]);
    return { fromId: from.id, toId: to.id, points, reason };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.fromId }),
});
