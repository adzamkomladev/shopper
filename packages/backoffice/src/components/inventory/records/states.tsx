import { Link } from "@tanstack/react-router";
import { ClipboardListIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";
import { InventorySkeleton } from "../states";

const SKELETON_ROWS = 6;

/** The table as it loads, under the segments, which are already there. */
export function RecordsResultsSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading stock records"
      className="flex flex-col rounded-lg border"
    >
      <Skeleton className="h-10 rounded-b-none" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** The branch picker's box, then the results: the toolbar is there at once, so the table starts where it will. */
export function RecordsBodySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-full sm:w-48" />
      <Skeleton className="h-9 w-96 max-w-full" />
      <RecordsResultsSkeleton />
    </div>
  );
}

export function RecordsSkeleton() {
  return (
    <InventorySkeleton action>
      <RecordsBodySkeleton />
    </InventorySkeleton>
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
            <Link to="/stock/receive" search={{ branch: branchId }}>
              Receive goods
              <Kbd aria-hidden className="bg-primary-foreground/5">
                R
              </Kbd>
            </Link>
          </Button>
        )
      )}
    </EmptyList>
  );
}
