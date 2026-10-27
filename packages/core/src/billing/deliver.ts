import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { invoice, org, user } from "@shopper/db-pg";
import { formatGHS } from "@shopper/money";
import type { Delivery } from "@shopper/ports";
import { formatDay } from "@shopper/utils";
import type { StatementDeliveryDeps } from "../customers";
import { invoiceMessage } from "./schemas/base";

type Deps = Pick<StatementDeliveryDeps, "db" | "mail" | "baseUrl">;

/** Emails one owner an invoice, a reminder, or the read-only notice, with the checkout link to pay it. */
export async function deliverInvoiceEmail(deps: Deps, delivery: Delivery) {
  const message = v.parse(invoiceMessage, delivery.message);
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const orgId = delivery.message.orgId;
  const [row] = await deps.db
    .select({ invoice, shop: org.name, email: user.email })
    .from(invoice)
    .innerJoin(org, eq(org.id, invoice.orgId))
    .innerJoin(user, and(eq(user.orgId, invoice.orgId), eq(user.id, message.payload.userId)))
    .where(and(eq(invoice.orgId, orgId), eq(invoice.id, message.payload.invoiceId)));
  // A paid invoice needs no reminder; the issued email still goes out as its receipt of record.
  if (!row || (row.invoice.status === "paid" && message.type !== "invoice.issued"))
    return await delivery.ack();
  const settings = `${deps.baseUrl.replace(/\/$/, "")}/settings/billing`;
  const link = row.invoice.checkoutUrl ?? settings;
  const amount = formatGHS(row.invoice.amount);
  const period = `${formatDay(row.invoice.periodStart)} to ${formatDay(row.invoice.periodEnd)}`;
  const opening = {
    "invoice.issued": `Your Shopper invoice for ${period} is ready: ${amount} for ${row.invoice.stores} store(s) and ${row.invoice.terminals} register(s).`,
    "invoice.reminder": `A reminder that your Shopper invoice for ${period}, ${amount}, is still unpaid.`,
    "invoice.read_only": `Your Shopper invoice for ${period}, ${amount}, is 14 days overdue, so the back office is now read-only. Your tills keep selling.`,
  }[message.type];
  await deps.mail({
    email: row.email,
    subject: {
      "invoice.issued": `${row.shop}: Shopper invoice for ${period}`,
      "invoice.reminder": `${row.shop}: your Shopper invoice is unpaid`,
      "invoice.read_only": `${row.shop}: the back office is read-only until the invoice is paid`,
    }[message.type],
    link,
    plain: [opening, "", `Pay it here: ${link}`, "", `Billing settings: ${settings}`].join("\n"),
    attachments: [],
  });
  await delivery.ack();
}
