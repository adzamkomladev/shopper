import { ReceiptIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";

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

/** The table's place while a page loads: its header and rows. */
export function TransactionRowsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading transactions"
      className="flex flex-col rounded-lg border"
    >
      <Skeleton className="h-10 rounded-b-none" />
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="hidden h-5 w-36 md:block" />
          <Skeleton className="hidden h-5 w-20 lg:block" />
          <Skeleton className="hidden h-5 w-24 md:block" />
          <Skeleton className="hidden h-5 w-24 lg:block" />
          <Skeleton className="h-5.5 w-24 rounded-full" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** The heading, filters, tabs and table of the loaded screen, so nothing moves when the data arrives. */
export function TransactionsSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading transactions"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-15.5 w-96 max-sm:w-full" />
        <Skeleton className="h-15.5 w-44 max-sm:w-full" />
      </div>
      <Skeleton className="h-9 w-96 max-w-full" />
      <TransactionRowsSkeleton />
    </div>
  );
}
