import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { enqueueAfterCommit } from "@shopper/audit";
import { customer, receiptEmail, type ShopperTransaction } from "@shopper/db-pg";

/**
 * Records one receipt email for a sale and queues it after the transaction commits. A request key seen before
 * queues nothing, so a redelivered sale or a repeated click sends once. Answers the row's id.
 */
export async function queueReceiptEmail(
  tx: ShopperTransaction,
  orgId: string,
  input: { saleId: string; email: string; requestKey: string },
) {
  const [created] = await tx
    .insert(receiptEmail)
    .values({ orgId, ...input })
    .onConflictDoNothing({ target: [receiptEmail.orgId, receiptEmail.requestKey] })
    .returning({ id: receiptEmail.id });
  if (created)
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId,
      v: 1,
      sequence: "0",
      type: "receipt.email",
      payload: { id: created.id, saleId: input.saleId },
    });
  return created?.id;
}

/** The sale's own receipt email, when its customer has an address on file. */
export async function queueSaleReceipt(
  tx: ShopperTransaction,
  orgId: string,
  sale: { id: string; customerId: string },
) {
  const [buyer] = await tx
    .select({ email: customer.email })
    .from(customer)
    .where(and(eq(customer.orgId, orgId), eq(customer.id, sale.customerId)));
  if (buyer?.email)
    await queueReceiptEmail(tx, orgId, {
      saleId: sale.id,
      email: buyer.email,
      requestKey: `sale:${sale.id}`,
    });
}
