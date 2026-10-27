import { desc, eq } from "drizzle-orm";
import { invoice, subscription, type ShopperDatabase } from "@shopper/db-pg";
import { invoiceView } from "./commands";

/** The org's subscription and its invoices, newest first; a box org has no subscription. */
export async function readBilling(db: ShopperDatabase, orgId: string) {
  const [plan] = await db.select().from(subscription).where(eq(subscription.orgId, orgId));
  const invoices = await db
    .select()
    .from(invoice)
    .where(eq(invoice.orgId, orgId))
    .orderBy(desc(invoice.periodStart))
    .limit(24);
  return {
    subscription: plan
      ? { status: plan.status, billingDay: plan.billingDay, nextInvoiceOn: plan.nextInvoiceOn }
      : null,
    invoices: invoices.map(invoiceView),
  };
}
