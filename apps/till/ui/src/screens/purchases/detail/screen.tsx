import type { PurchaseDetails } from "@shopper/sync/bridge";
import { Badge } from "@shopper/ui/components/badge";
import { ReceiptText } from "lucide-react";
import { DetailItems } from "../../../components/purchases/detail/items";
import { DetailPayment } from "../../../components/purchases/detail/payment";
import { DetailTotals } from "../../../components/purchases/detail/totals";

export function PurchaseDetail({ purchase }: { purchase: PurchaseDetails }) {
  const receipt = purchase.receipt;
  const receiptNumber = purchase.receiptNumber ?? receipt?.header.receiptNumber;
  const reference = receiptNumber ?? purchase.id.slice(0, 8);
  return (
    <section
      aria-label="Purchase details"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-1"
      tabIndex={0}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex min-w-64 flex-1 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ReceiptText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Purchase details</h2>
              <Badge
                variant={
                  purchase.status === "voided"
                    ? "destructive"
                    : purchase.status === "completed"
                      ? "default"
                      : "secondary"
                }
              >
                {statusLabel(purchase.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {receiptNumber ? "Receipt" : "Purchase"} {reference}
            </p>
          </div>
        </div>
        <Fact
          label="Purchased"
          value={receipt?.header.accraTime ?? accraTime(purchase.occurredAt)}
        />
        {receipt?.header.cashier && <Fact label="Cashier" value={receipt.header.cashier} />}
        {receipt?.header.branch && <Fact label="Branch" value={receipt.header.branch} />}
      </header>

      <div className="grid min-h-0 shrink-0 grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <DetailItems purchase={purchase} />
        <aside className="grid gap-4 xl:col-span-4">
          <DetailTotals purchase={purchase} />
          <DetailPayment purchase={purchase} />
        </aside>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function statusLabel(status: PurchaseDetails["status"]) {
  return status === "pending" ? "Pending MoMo" : status === "voided" ? "Voided" : "Completed";
}

function accraTime(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
