import { and, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { accountHold, creditEntry, customer, loyaltyEntry } from "@shopper/db-pg";
import { sub, money } from "@shopper/money";
import { CustomerError } from "./error";
import { publishCustomer } from "./feed";
import { wakeAccount } from "./accounts/wake";
import { readCustomerRow } from "./queries";

type Merge = { winnerId: string; loserId: string; now: Date };

/**
 * Folds the loser's account into the winner's: a transfer entry leaves the loser and an equal one
 * enters the winner on each ledger, so both folds are unchanged in total. The loser is archived
 * and points at the winner, and its held holds are released. Sales keep the loser's id.
 */
export const mergeCustomers = defineCommand({
  name: "customer.merge",
  async run(tx, ctx, input: Merge) {
    if (input.winnerId.toLowerCase() === input.loserId.toLowerCase())
      throw new CustomerError("MERGE_SELF", "A customer cannot be merged into itself");
    // Lock in id order so two merges cannot deadlock; the folds are read once both are held.
    const [first, second] = [input.winnerId, input.loserId].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    const locked = [
      await readCustomerRow(tx, ctx.orgId, first!, true),
      await readCustomerRow(tx, ctx.orgId, second!, true),
    ];
    const winner = locked.find((row) => row.id === input.winnerId.toLowerCase())!;
    const loser = locked.find((row) => row.id === input.loserId.toLowerCase())!;
    if (winner.archivedAt || loser.archivedAt)
      throw new CustomerError("MERGE_UNAVAILABLE", "Both customers must be active to merge");
    const entry = { orgId: ctx.orgId, actorId: ctx.actorId, occurredAt: input.now };
    if (loser.balance !== 0)
      await tx.insert(creditEntry).values([
        { ...entry, customerId: loser.id, kind: "transfer", amount: sub(money(0), loser.balance) },
        { ...entry, customerId: winner.id, kind: "transfer", amount: loser.balance },
      ]);
    if (loser.points !== 0)
      await tx.insert(loyaltyEntry).values([
        { ...entry, customerId: loser.id, reason: "transfer", points: -loser.points },
        { ...entry, customerId: winner.id, reason: "transfer", points: loser.points },
      ]);
    await tx
      .update(accountHold)
      .set({ status: "released", updatedAt: input.now })
      .where(
        and(
          eq(accountHold.orgId, ctx.orgId),
          eq(accountHold.customerId, loser.id),
          eq(accountHold.status, "held"),
        ),
      );
    const [row] = await tx
      .update(customer)
      .set({
        mergedIntoId: winner.id,
        archivedAt: input.now,
        version: sql`${customer.version} + 1`,
        updatedAt: input.now,
      })
      .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, loser.id)))
      .returning();
    await publishCustomer(tx, ctx.orgId, row!);
    wakeAccount(tx, ctx.orgId, winner.id);
    wakeAccount(tx, ctx.orgId, loser.id);
    return {
      winnerId: winner.id,
      loserId: loser.id,
      balance: loser.balance,
      points: loser.points,
    };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.winnerId }),
});
