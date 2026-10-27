import { useSuspenseQuery } from "@tanstack/react-query";
import { InvoiceTable, PAY_ID } from "../../components/billing/invoices";
import { BillingSkeleton, NoInvoices } from "../../components/billing/states";
import { SubscriptionSummary } from "../../components/billing/summary";
import { Gate } from "../../components/register/states";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { billingQuery } from "../../queries/billing";

/** The Shopper subscription and its invoices; P opens the overdue one's Paystack checkout. */
export function BillingScreen() {
  const shortcuts = useShortcuts({ P: () => document.getElementById(PAY_ID)?.click() });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Billing
      </h1>
      <Gate need="billing.manage" what="billing" fallback={<BillingSkeleton />}>
        <Billing />
      </Gate>
    </div>
  );
}

function Billing() {
  const { data } = useSuspenseQuery(billingQuery());
  return (
    <>
      <SubscriptionSummary subscription={data.subscription} />
      <h2 className="text-lg font-semibold">Invoices</h2>
      {data.invoices.length ? <InvoiceTable invoices={data.invoices} /> : <NoInvoices />}
    </>
  );
}
