import { Link } from "@tanstack/react-router";
import { ClipboardListIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../admin/states";
import { InventoryPage } from "../tabs";
import { FROM_LG, FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Date",
    // A phone adds the type and the cost under the date.
    cell: (
      <div className="flex flex-col items-start gap-1">
        <Skeleton className="my-0.5 h-4 w-28" />
        <Skeleton className="h-5.5 w-16 rounded-full md:hidden" />
      </div>
    ),
  },
  {
    header: "Type",
    className: FROM_MD,
    cell: <Skeleton className="h-5.5 w-16 rounded-full" />,
  },
  { header: "Supplier or cause", cell: <Skeleton className="h-4 w-32" /> },
  { header: "Reference", className: FROM_LG, cell: <Skeleton className="h-4 w-24" /> },
  { header: "Items", className: FROM_LG, cell: <Skeleton className="h-4 w-20" /> },
  { header: "By", className: FROM_LG, cell: <Skeleton className="h-4 w-24" /> },
  {
    header: "Total cost",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-20" />,
  },
];

/** The table as it loads, under the segments, which are already there. */
export function RecordsResultsSkeleton() {
  return (
    <DataTableSkeleton label="Loading stock records" columns={COLUMNS} rows={SKELETON_ROWS} fill />
  );
}

/** The branch picker's box, then the results: the toolbar is there at once, so the table starts where it will. */
export function RecordsBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-8 w-full sm:w-48" />
      <Skeleton className="h-9 w-96 max-w-full" />
      <RecordsResultsSkeleton />
    </div>
  );
}

export function RecordsSkeleton() {
  return (
    <InventoryPage active="records" action={<Skeleton className="h-8 w-33" />}>
      <RecordsBodySkeleton />
    </InventoryPage>
  );
}

type EmptyProps = { branchId: string; branchName: string; label?: string; canWrite: boolean };

/** Nothing recorded yet, or none of the kind chosen; the next step is to record one, or to see them all. */
export function NoRecords({ branchId, branchName, label, canWrite }: EmptyProps) {
  return (
    <EmptyList
      icon={ClipboardListIcon}
      title={label ? `No ${label.toLowerCase()} records` : "No stock records yet"}
      description={
        label
          ? `Nothing at ${branchName} has been ${label.toLowerCase()} yet. The other kinds are one tab over.`
          : `Deliveries, adjustments and stock counts at ${branchName} are listed here once they are recorded.`
      }
    >
      {label ? (
        <Button variant="outline" asChild>
          <Link
            to="/stock/records"
            search={{ branch: branchId }}
            replace
            // The empty state is about to go: focus stays on the segments, which do not.
            onClick={() => document.querySelector<HTMLElement>('[data-segment="all"]')?.focus()}
          >
            Show all records
          </Link>
        </Button>
      ) : (
        canWrite && (
          <Button asChild>
            <Link aria-keyshortcuts="R" to="/stock/receive" search={{ branch: branchId }}>
              Receive goods
            </Link>
          </Button>
        )
      )}
    </EmptyList>
  );
}
