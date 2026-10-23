import { and, desc, eq } from "drizzle-orm";
import { sale, statementDelivery } from "@shopper/db-pg";
import type { Queryable } from "../types";
import { readCustomerRow } from "./queries";

/** Rows the back office shows without paging: a customer's most recent sales or sent statements. */
// ponytail: newest 100 only; add a cursor when a customer's history outgrows it.
const RECENT = 100;

/** A customer's sales, newest first: what the Purchases tab lists. */
export async function listCustomerSales(db: Queryable, orgId: string, customerId: string) {
  const current = await readCustomerRow(db, orgId, customerId);
  const rows = await db
    .select({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      occurredAt: sale.occurredAt,
      total: sale.total,
      status: sale.status,
    })
    .from(sale)
    .where(and(eq(sale.orgId, orgId), eq(sale.customerId, current.id)))
    .orderBy(desc(sale.occurredAt), desc(sale.id))
    .limit(RECENT);
  return { items: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })) };
}

/** The statements sent to a customer, newest first, with the status the delivery has reached. */
export async function listStatementDeliveries(db: Queryable, orgId: string, customerId: string) {
  const current = await readCustomerRow(db, orgId, customerId);
  const rows = await db
    .select()
    .from(statementDelivery)
    .where(and(eq(statementDelivery.orgId, orgId), eq(statementDelivery.customerId, current.id)))
    .orderBy(desc(statementDelivery.createdAt), desc(statementDelivery.id))
    .limit(RECENT);
  return {
    items: rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      from: row.periodFrom,
      to: row.periodTo,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
