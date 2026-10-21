import { ClipboardCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../../admin/states";
import { InventorySkeleton } from "../../states";

const SKELETON_ROWS = 6;

/** The table as it loads, under the branch picker, which is already there. */
export function TakesResultsSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading stock takes"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
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

export function TakesBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-9 w-full sm:w-48" />
      <TakesResultsSkeleton />
    </div>
  );
}

export function TakesSkeleton() {
  return (
    <InventorySkeleton action>
      <TakesBodySkeleton />
    </InventorySkeleton>
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
        <Button onClick={onStart} disabled={!online}>
          Start a stock take
          <Kbd aria-hidden className="bg-primary-foreground/5">
            N
          </Kbd>
        </Button>
      )}
    </EmptyList>
  );
}
