import { ReceiptIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";
import { FROM_LG, FROM_MD } from "./table";
import { StatusTabs } from "./tabs";

export function NoTransactions({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return filtered ? (
    <EmptyList
      icon={SearchXIcon}
      title="Nothing matches this search"
      description="Check the receipt number or reference, widen the dates, or clear the filters."
    >
      <Button variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </EmptyList>
  ) : (
    <EmptyList
      icon={ReceiptIcon}
      title="No transactions on these days"
      description="Sales from every till show here once they sync, with their receipts, payments and refunds."
    />
  );
}

// The loaded table's columns: a phone keeps the receipt, status and total, as there.
const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Time / receipt",
    cell: (
      <>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-16" />
      </>
    ),
  },
  { header: "Customer", className: FROM_MD, cell: <Skeleton className="h-5 w-24" /> },
  { header: "Items", className: FROM_LG, cell: <Skeleton className="h-5 w-10" /> },
  { header: "Payment", className: FROM_MD, cell: <Skeleton className="h-5 w-20" /> },
  { header: "Cashier", className: FROM_LG, cell: <Skeleton className="h-5 w-22" /> },
  { header: "Status", cell: <Skeleton className="h-5 w-18 rounded-full" /> },
  {
    header: "Total",
    className: "text-right",
    cell: <Skeleton className="ml-auto h-5 w-16" />,
  },
];

/** The table's place while a page loads: the loaded one's header and rows. */
export function TransactionRowsSkeleton() {
  return <DataTableSkeleton label="Loading transactions" columns={COLUMNS} />;
}

/** A label above a control: the filters' fields all stack this way. */
function Field({ className }: { className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3.5 w-10" />
      <Skeleton className={`h-8 ${className}`} />
    </div>
  );
}

/** The heading, filters, tabs and table of the loaded screen, so nothing moves when the data arrives. */
export function TransactionsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-35" />
        <Skeleton className="h-8 w-30" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex flex-wrap items-end gap-2 max-sm:w-full">
          <div className="grid grid-cols-2 gap-2 max-sm:w-full sm:flex">
            <Field className="w-full sm:w-40" />
            <Field className="w-full sm:w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
        <div className="flex flex-col gap-2 max-sm:w-full">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-8 w-full sm:w-44" />
        </div>
      </div>
      <StatusTabs search={{}}>
        <TransactionRowsSkeleton />
      </StatusTabs>
    </div>
  );
}
