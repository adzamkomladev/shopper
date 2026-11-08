import { useSuspenseQuery } from "@tanstack/react-query";
import { InvoiceTable, PAY_ID } from "../../components/billing/invoices";
import { BillingSkeleton, NoInvoices } from "../../components/billing/states";
import { SubscriptionSummary } from "../../components/billing/summary";
import { CHECK_IN_ID, LicenceCard } from "../../components/billing/licence";
import { UpdatesCard } from "../../components/billing/updates/card";
import { Gate } from "../../components/register/states";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { billingQuery } from "../../queries/billing";

/**
 * The Shopper subscription and its invoices; P opens the overdue one's Paystack checkout. A box bills nobody: it
 * shows its licence instead, and C checks it in.
 */
export function BillingScreen() {
  const shortcuts = useShortcuts({
    P: () => document.getElementById(PAY_ID)?.click(),
    C: () => document.getElementById(CHECK_IN_ID)?.click(),
  });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
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
  if (data.licence)
    return (
      <>
        <LicenceCard licence={data.licence} />
        <UpdatesCard />
      </>
    );
  return (
    <>
      <SubscriptionSummary subscription={data.subscription} />
      <h2 className="text-base font-semibold">Invoices</h2>
      {data.invoices.length ? <InvoiceTable invoices={data.invoices} /> : <NoInvoices />}
    </>
  );
}
