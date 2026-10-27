"use no memo";
import { ExternalLinkIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { statementDay } from "../../lib/statements/format";
import type { InvoiceRow } from "../../schemas/billing";

export const PAY_ID = "billing-pay";

/** Every invoice, newest first; an open one links to its Paystack checkout. */
export function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  // P pays the oldest open invoice: the one keeping the back office read-only.
  const due = invoices.filter((invoice) => invoice.status === "open" && invoice.checkoutUrl).at(-1);
  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {statementDay(row.original.periodStart)} – {statementDay(row.original.periodEnd)}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.reference}</span>
        </div>
      ),
    },
    {
      id: "size",
      header: "Stores and registers",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) =>
        `${row.original.stores} ${row.original.stores === 1 ? "store" : "stores"}, ${row.original.terminals} ${row.original.terminals === 1 ? "register" : "registers"}`,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <InvoiceBadge invoice={row.original} />,
    },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={money(row.original.amount)} className="font-semibold" />,
    },
    {
      id: "pay",
      header: () => <span className="sr-only">Pay</span>,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.status === "open" && row.original.checkoutUrl ? (
          <Button asChild size="sm">
            <a
              id={row.original.id === due?.id ? PAY_ID : undefined}
              href={row.original.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              aria-keyshortcuts={row.original.id === due?.id ? "P" : undefined}
            >
              Pay now
              <ExternalLinkIcon aria-hidden />
            </a>
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable label="Invoices" columns={columns} data={invoices} getRowId={(row) => row.id} />
  );
}

function InvoiceBadge({ invoice }: { invoice: InvoiceRow }) {
  if (invoice.status === "paid") return <Badge>Paid</Badge>;
  if (invoice.status === "void") return <Badge variant="outline">Void</Badge>;
  return (
    <Badge variant={invoice.reminders > 0 ? "destructive" : "secondary"}>
      {invoice.reminders > 0 ? "Overdue" : "Open"}
    </Badge>
  );
}
