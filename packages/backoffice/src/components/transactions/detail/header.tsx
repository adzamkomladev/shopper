import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ReceiptTextIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Card } from "@shopper/ui/components/card";
import { focusOnMount } from "../../../lib/focus";
import type { TransactionDetail } from "../../../schemas/transactions";
import { StatusBadge } from "../status";
import { dateTimeLabel } from "./format";

/** The receipt, its state, when, who rang it up and for whom, with the receipt's actions. */
export function TransactionHeader({
  sale,
  actions,
}: {
  sale: TransactionDetail;
  actions: React.ReactNode;
}) {
  const facts = [
    ["Purchased", dateTimeLabel(sale.occurredAt)],
    ["Cashier", sale.cashier.name ?? "—"],
    ["Customer", sale.customer?.name ?? "Walk-in customer"],
  ];
  return (
    <header className="flex flex-col gap-3">
      <BackToTransactions />
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <ReceiptTextIcon aria-hidden className="size-5 text-muted-foreground" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {/* Focused on arrival, so M and Backspace work straight away. */}
              <h1
                tabIndex={-1}
                ref={focusOnMount}
                className="text-2xl font-bold tracking-tight outline-none"
              >
                Receipt {sale.receiptNumber}
              </h1>
              <StatusBadge status={sale.status} />
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold wrap-break-word">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </Card>
    </header>
  );
}

/** Known before the sale loads, so the loading skeleton shows it too. */
export function BackToTransactions() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
      <Link to="/transactions">
        <ArrowLeftIcon aria-hidden />
        Back to transactions
      </Link>
    </Button>
  );
}
