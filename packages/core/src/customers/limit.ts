import { and, eq, sql } from "drizzle-orm";
import { customer, type ShopperTransaction } from "@shopper/db-pg";
import type { Money } from "@shopper/money";
import { publishCustomer } from "./feed";
import { readCustomerRow } from "./queries";

/**
 * Sets a customer's credit limit. A limit needs a KYC date (customer_credit_kyc), so both are written together,
 * and the change goes on every store's feed. Not a command: the caller's command audits it.
 */
export async function setCreditLimit(
  tx: ShopperTransaction,
  orgId: string,
  id: string,
  limit: Money,
  verifiedAt: Date,
) {
  const current = await readCustomerRow(tx, orgId, id, true);
  const [row] = await tx
    .update(customer)
    .set({
      creditLimit: limit,
      kycVerifiedAt: verifiedAt,
      version: sql`${customer.version} + 1`,
      updatedAt: verifiedAt,
    })
    .where(and(eq(customer.orgId, orgId), eq(customer.id, current.id)))
    .returning();
  await publishCustomer(tx, orgId, row!);
  return { id: current.id, before: current.creditLimit, after: row!.creditLimit };
}
