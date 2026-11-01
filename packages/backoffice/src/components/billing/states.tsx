import { ReceiptIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Card, CardContent, CardHeader } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { CellLines } from "../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

export function NoInvoices() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No invoices yet</EmptyTitle>
        <EmptyDescription>The first one is raised on the billing day.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

const INVOICE_ROWS = 3;

/** The subscription card, the Invoices heading and the invoice table, under the screen's own heading. */
export function BillingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading billing"
    >
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5.5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-full" />
        </CardContent>
      </Card>
      <h2 className="text-base font-semibold">Invoices</h2>
      <DataTableSkeleton
        rows={INVOICE_ROWS}
        columns={[
          { header: "Period", cell: <CellLines lines={["h-5 w-44", "h-4 w-28"]} /> },
          {
            header: "Stores and registers",
            className: "hidden md:table-cell",
            cell: <Skeleton className="h-5 w-36" />,
          },
          { header: "Status", cell: <Skeleton className="h-5.5 w-16 rounded-full" /> },
          {
            header: "Amount",
            className: "text-right",
            cell: <Skeleton className="ml-auto h-5 w-24" />,
          },
          { header: "", className: "text-right", cell: <Skeleton className="ml-auto h-7 w-24" /> },
        ]}
      />
    </div>
  );
}

/** The heading and the body, while the route loads. */
export function BillingPending() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <BillingSkeleton />
    </div>
  );
}
