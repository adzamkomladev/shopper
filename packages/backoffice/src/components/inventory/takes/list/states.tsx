import { ClipboardCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../../admin/states";
import { InventoryPage } from "../../tabs";
import { FROM_LG, FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Started",
    cell: (
      <div className="flex flex-col items-start gap-1">
        <Skeleton className="my-0.5 h-4 w-28" />
        <Skeleton className="h-5.5 w-16 rounded-full md:hidden" />
      </div>
    ),
  },
  { header: "Status", className: FROM_MD, cell: <Skeleton className="h-5.5 w-20 rounded-full" /> },
  { header: "Covers", cell: <Skeleton className="h-4 w-32" /> },
  { header: "Counted", cell: <Skeleton className="h-4 w-16" /> },
  { header: "Started by", className: FROM_LG, cell: <Skeleton className="h-4 w-24" /> },
  { header: "Closed", className: FROM_LG, cell: <Skeleton className="h-4 w-28" /> },
];

/** The table as it loads, under the branch picker, which is already there. */
export function TakesResultsSkeleton() {
  return (
    <DataTableSkeleton label="Loading stock takes" columns={COLUMNS} rows={SKELETON_ROWS} fill />
  );
}

export function TakesBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-8 w-full sm:w-48" />
      <TakesResultsSkeleton />
    </div>
  );
}

export function TakesSkeleton() {
  return (
    <InventoryPage active="takes" action={<Skeleton className="h-8 w-35.25" />}>
      <TakesBodySkeleton />
    </InventoryPage>
  );
}

type EmptyProps = { branchName: string; canWrite: boolean; online: boolean; onStart: () => void };

/** No take at this branch yet; the next step is to start one. */
export function NoTakes({ branchName, canWrite, online, onStart }: EmptyProps) {
  return (
    <EmptyList
      icon={ClipboardCheckIcon}
      title="No stock takes yet"
      description={`A stock take counts what is on the shelves at ${branchName} and posts the difference. Your takes are listed here.`}
    >
      {canWrite && (
        <Button aria-keyshortcuts="N" onClick={onStart} disabled={!online}>
          Start a stock take
        </Button>
      )}
    </EmptyList>
  );
}
