import { ClipboardCheckIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../../admin/states";

// More rows than any window shows: the sheet fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Product",
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-48" />
        <Skeleton className="my-0.5 h-3 w-28" />
      </div>
    ),
  },
  {
    header: "Count",
    className: "w-36 text-right sm:w-48",
    cell: <Skeleton className="ml-auto h-8 w-28 sm:w-40" />,
  },
  { header: "Status", className: "hidden md:table-cell", cell: <Skeleton className="h-4 w-24" /> },
];

/** Same shape as the loaded sheet, as measured: back link, heading, progress and buttons, then the lines. */
export function SheetSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-37.5" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-30" />
          {/* The description wraps to two lines below a laptop. */}
          <Skeleton className="h-10 w-72 max-w-full lg:h-5" />
        </div>
      </div>
      <Skeleton className="h-19.5 w-full sm:h-8.5" />
      <DataTableSkeleton label="Loading stock take" columns={COLUMNS} rows={SKELETON_ROWS} fill />
    </div>
  );
}

/** Nothing left to count: what to do next. */
export function AllCounted() {
  return (
    <EmptyList
      icon={ClipboardCheckIcon}
      title="Every product is counted"
      description="Review the variance, then post the take to bring stock on hand in line with the count."
    />
  );
}
