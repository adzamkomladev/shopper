import { InvoiceTable, NoInvoices, shiftTime, SubscriptionSummary } from "@shopper/backoffice/kit";
import type { TenantDetail } from "../../../schemas/types";
import { Stats } from "./header";

/** The subscription, what is owed, and every invoice with whether it was paid. */
export function TenantBilling({ billing }: { billing: TenantDetail["billing"] }) {
  const open = billing.invoices.filter((invoice) => invoice.status === "open");
  const paid = billing.invoices.filter((invoice) => invoice.status === "paid");
  return (
    <>
      <Stats
        items={[
          ["Open invoices", open.length],
          ["Overdue", open.filter((invoice) => invoice.reminders > 0).length],
          ["Paid invoices", paid.length],
          ["Last paid", paid[0]?.paidAt ? shiftTime(paid[0].paidAt) : "Never"],
        ]}
      />
      <SubscriptionSummary subscription={billing.subscription} />
      <h2 className="text-base font-semibold">Invoices</h2>
      {billing.invoices.length ? <InvoiceTable invoices={billing.invoices} /> : <NoInvoices />}
    </>
  );
}
