import { Skeleton } from "@shopper/ui/components/skeleton";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

// The tab tables are content-height up to a cap, so a few rows stand for a customer with some history.
const ROWS = 5;

/** The Purchases table: date, receipt, status and total. */
export function PurchasesSkeleton() {
  return (
    <DataTableSkeleton
      label="Loading purchases"
      rows={ROWS}
      columns={[
        { header: "Date", cell: <Skeleton className="h-4 w-28" /> },
        {
          header: "Receipt",
          className: "hidden sm:table-cell",
          cell: <Skeleton className="h-4 w-24" />,
        },
        {
          header: "Status",
          className: "hidden sm:table-cell",
          cell: <Skeleton className="h-5 w-16 rounded-full" />,
        },
        {
          header: "Total",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-4 w-20" />,
        },
      ]}
    />
  );
}

/** The Points history table: date, what happened, the change and the balance. */
export function PointsSkeleton() {
  return (
    <DataTableSkeleton
      label="Loading points history"
      rows={ROWS}
      columns={[
        { header: "Date", cell: <Skeleton className="h-4 w-28" /> },
        { header: "What happened", cell: <Skeleton className="h-4 w-32" /> },
        {
          header: "Points",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-4 w-8" />,
        },
        {
          header: "Balance",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-4 w-10" />,
        },
      ]}
    />
  );
}

/** The statement table: date, what happened, the amount and the running balance. */
export function StatementTableSkeleton() {
  return (
    <DataTableSkeleton
      label="Loading the statement"
      rows={ROWS}
      columns={[
        { header: "Date", cell: <Skeleton className="h-4 w-28" /> },
        { header: "What happened", cell: <Skeleton className="h-4 w-40" /> },
        {
          header: "Amount",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-4 w-20" />,
        },
        {
          header: "Balance",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-4 w-20" />,
        },
      ]}
    />
  );
}

/** One line of a statement section's list, as tall as the "No links are open" line that is most often there. */
export function ListLineSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Skeleton className="my-0.5 h-4 w-48" />
    </div>
  );
}
