import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";

const ITEM_ROWS = 5;
const FROM_MD = "hidden md:table-cell";

// A receipt's items, the longest case: an adjustment or a count shows the product and its change.
const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Product",
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-48" />
        <Skeleton className="my-0.5 h-3 w-28" />
        <Skeleton className="my-0.5 h-3 w-32 md:hidden" />
      </div>
    ),
  },
  {
    header: "Received",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
  {
    header: "Unit cost",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
  {
    header: "Line total",
    className: "text-right",
    cell: <Skeleton className="ml-auto h-4 w-20" />,
  },
];

/** Same shape as the loaded record: back link, heading, four cards, then the items. */
export function RecordSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading stock record"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-32" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-30.5" />
        <Skeleton className="h-30.5" />
        <Skeleton className="h-30.5" />
        <Skeleton className="h-30.5" />
      </div>
      <DataTableSkeleton label="Loading items" columns={COLUMNS} rows={ITEM_ROWS} />
    </div>
  );
}
