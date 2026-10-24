import { eq } from "drizzle-orm";
import { org } from "@shopper/db-pg";
import type { StatementDocument } from "../../schemas/customers/statements";
import type { Queryable } from "../../types";
import { readStatement } from "../credit/statement";
import { readCustomerRow } from "../queries";

/**
 * The statement a customer, the PDF and the messages see: the shop, the customer, the period and its
 * entries with their running balance. Ledger, sale and refund ids stay on the server.
 */
export async function readStatementDocument(
  db: Queryable,
  orgId: string,
  customerId: string,
  period: { from: string; to: string },
): Promise<StatementDocument> {
  const statement = await readStatement(db, orgId, customerId, period);
  const { name, phone } = await readCustomerRow(db, orgId, customerId);
  const [shop] = await db.select({ name: org.name }).from(org).where(eq(org.id, orgId));
  return {
    v: 1,
    shop: { name: shop!.name },
    customer: { name, phone },
    period: { from: statement.from, to: statement.to },
    opening: statement.opening,
    entries: statement.entries.map(({ kind, method, amount, balance, occurredAt }) => ({
      kind,
      method,
      amount,
      balance,
      occurredAt,
    })),
    closing: statement.closing,
  };
}
