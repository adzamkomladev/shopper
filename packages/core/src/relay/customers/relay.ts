import { and, desc, eq, inArray } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { relayCustomer, relayReceipt, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { RelayCustomers, RelayCustomerWire } from "../../schemas/relay";
import type { ShopSession } from "../../shop/types";

type Points = RelayCustomerWire["points"];
// Matches the box's own account pages: newest 100 receipts.
const RECENT = 100;

/**
 * A box's customers who agreed to see receipts and points online, as the relay org keeps them (v1.5 Day 51): each
 * one published replaces that customer's copy whole, and a withdrawn one is gone with its receipts. Only the box's
 * licence-signed publish writes these tables.
 */
export const publishRelayCustomers = defineCommand({
  name: "relay.customers.published",
  async run(tx, ctx, input: { batch: RelayCustomers }) {
    const ids = [...input.batch.customers.map((row) => row.id), ...input.batch.withdrawn];
    if (ids.length)
      await tx
        .delete(relayCustomer)
        .where(and(eq(relayCustomer.orgId, ctx.orgId), inArray(relayCustomer.id, ids)));
    // A receipt whose customer changed phone may still sit under a customer of a later batch.
    const receipts = input.batch.customers.flatMap((row) =>
      row.receipts.map((receipt) => receipt.id),
    );
    if (receipts.length)
      await tx
        .delete(relayReceipt)
        .where(and(eq(relayReceipt.orgId, ctx.orgId), inArray(relayReceipt.id, receipts)));
    for (const row of input.batch.customers) {
      await tx
        .insert(relayCustomer)
        .values({ orgId: ctx.orgId, id: row.id, phone: row.phone, points: row.points });
      if (row.receipts.length)
        await tx.insert(relayReceipt).values(
          row.receipts.map((receipt) => ({
            ...receipt,
            orgId: ctx.orgId,
            customerId: row.id,
            occurredAt: new Date(receipt.occurredAt),
            total: receipt.total === null ? null : money(receipt.total),
          })),
        );
    }
    return { customers: input.batch.customers.length, withdrawn: input.batch.withdrawn.length };
  },
  // Counts only: the copy holds phones and receipts, which stay out of the audit chain.
  audit: (_input, output) => output,
});

/** The shopper's points on a relay org: what their box published for their phone, or nothing yet. */
export async function relayShopPoints(
  db: ShopperDatabase,
  session: Pick<ShopSession, "orgId" | "phone">,
): Promise<Points> {
  const [row] = await db
    .select({ points: relayCustomer.points })
    .from(relayCustomer)
    .where(and(eq(relayCustomer.orgId, session.orgId), eq(relayCustomer.phone, session.phone)))
    .orderBy(relayCustomer.id)
    .limit(1);
  return (row?.points as Points) ?? { enabled: false, points: 0, tier: null, entries: [] };
}

/** The shopper's till receipts on a relay org, newest first (one of them when `id` is given). */
export function relayShopReceipts(db: ShopperDatabase, session: ShopSession, id?: string) {
  return db
    .select({
      id: relayReceipt.id,
      receiptNumber: relayReceipt.receiptNumber,
      occurredAt: relayReceipt.occurredAt,
      total: relayReceipt.total,
      status: relayReceipt.status,
      branchName: relayReceipt.branchName,
      receipt: relayReceipt.receipt,
    })
    .from(relayReceipt)
    .innerJoin(
      relayCustomer,
      and(
        eq(relayCustomer.orgId, relayReceipt.orgId),
        eq(relayCustomer.id, relayReceipt.customerId),
      ),
    )
    .where(
      and(
        eq(relayReceipt.orgId, session.orgId),
        eq(relayCustomer.phone, session.phone),
        ...(id ? [eq(relayReceipt.id, id)] : []),
      ),
    )
    .orderBy(desc(relayReceipt.occurredAt), desc(relayReceipt.id))
    .limit(RECENT);
}
