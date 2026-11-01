import { ClockIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";
import { FROM_LG, FROM_MD } from "./table";

export function NoShifts() {
  return (
    <EmptyList
      icon={ClockIcon}
      title="No closed shifts yet"
      description="A shift is a cashier's turn on a till. When a cashier counts the drawer and closes the shift, it appears here with its Z report."
    />
  );
}

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Closed",
    className: "whitespace-normal",
    cell: (
      <>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-40 lg:hidden" />
      </>
    ),
  },
  { header: "Register", className: FROM_LG, cell: <Skeleton className="h-5 w-12" /> },
  { header: "Branch", className: FROM_LG, cell: <Skeleton className="h-5 w-20" /> },
  { header: "Closed by", className: FROM_LG, cell: <Skeleton className="h-5 w-24" /> },
  { header: "Approved by", className: FROM_LG, cell: <Skeleton className="h-5 w-16" /> },
  {
    header: "Expected cash",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-5 w-16" />,
  },
  {
    header: "Declared cash",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-5 w-16" />,
  },
  {
    header: "Variance",
    cell: (
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5.5 w-14 rounded-full" />
        <Skeleton className="h-5.5 w-14 rounded-full" />
      </div>
    ),
  },
];

/** The heading, then the loaded table's own columns and rows with blocks in the cells. */
export function ShiftsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-8 w-16 shrink-0" />
      <DataTableSkeleton label="Loading shifts" columns={COLUMNS} />
    </div>
  );
}
