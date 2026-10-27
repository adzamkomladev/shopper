import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tenant, moneyColumn } from "./base";

export const subscriptionStatuses = ["active", "past_due", "read_only"] as const;
export const invoiceStatuses = ["open", "paid", "void"] as const;

/**
 * A cloud org's Shopper subscription. `read_only` stops back-office changes after 14 unpaid days; tills keep
 * trading. The box has no row, so it is never read-only.
 */
export const subscription = pgTable(
  "subscription",
  {
    ...tenant(),
    status: text("status", { enum: subscriptionStatuses }).notNull().default("active"),
    /** Day of the month invoices are raised, 1–28 so every month has it. */
    billingDay: integer("billing_day").notNull(),
    nextInvoiceOn: date("next_invoice_on").notNull(),
  },
  (t) => [
    unique().on(t.orgId),
    check("subscription_status", sql`${t.status} IN ('active', 'past_due', 'read_only')`),
    check("subscription_billing_day", sql`${t.billingDay} BETWEEN 1 AND 28`),
  ],
);

/** One month's bill. `reference` is the Paystack checkout reference and the billing workflow's business key. */
export const invoice = pgTable(
  "invoice",
  {
    ...tenant(),
    reference: text("reference").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    stores: integer("stores").notNull(),
    terminals: integer("terminals").notNull(),
    amount: moneyColumn("amount").notNull(),
    status: text("status", { enum: invoiceStatuses }).notNull().default("open"),
    checkoutUrl: text("checkout_url"),
    reminders: integer("reminders").notNull().default(0),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.reference),
    unique().on(t.orgId, t.periodStart),
    check("invoice_status", sql`${t.status} IN ('open', 'paid', 'void')`),
    check("invoice_amount", sql`${t.amount} >= 0 AND ${t.amount} % 100 = 0`),
    check("invoice_paid", sql`(${t.status} = 'paid') = (${t.paidAt} IS NOT NULL)`),
  ],
);
