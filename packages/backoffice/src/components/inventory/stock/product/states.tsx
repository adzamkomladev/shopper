import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";

const SKELETON_ROWS = 6;
const FROM_MD = "hidden md:table-cell";

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "When",
    // A phone has no Reason column: the reason sits under the time.
    cell: (
      <div className="flex flex-col items-start gap-1">
        <Skeleton className="my-0.5 h-4 w-28" />
        <Skeleton className="h-5.5 w-16 rounded-full md:hidden" />
      </div>
    ),
  },
  { header: "Reason", className: FROM_MD, cell: <Skeleton className="h-5.5 w-20 rounded-full" /> },
  { header: "Change", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-14" /> },
  { header: "Balance", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-16" /> },
  {
    header: "Unit cost",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
];

/** Same shape as the loaded page: back link, heading, three summary cards, then the movements. */
export function StockProductSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading product stock"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-29" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <DataTableSkeleton label="Loading movements" columns={COLUMNS} rows={SKELETON_ROWS} />
    </div>
  );
}
