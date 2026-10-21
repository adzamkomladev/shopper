import { Link } from "@tanstack/react-router";
import { PackageOpenIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";
import { InventorySkeleton } from "../states";

const SKELETON_ROWS = 6;

/** The summary card and table as they load, under the branch picker, which is already there. */
export function ValuationResultsSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading stock valuation"
      className="flex min-h-0 flex-1 flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Skeleton className="h-28 sm:h-30.5" />
        <Skeleton className="h-30 sm:h-30.5" />
      </div>
      <div className="flex min-h-52 flex-col overflow-hidden rounded-lg border">
        <Skeleton className="h-10 rounded-b-none" />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValuationBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-9 w-full sm:w-48" />
      <ValuationResultsSkeleton />
    </div>
  );
}

export function ValuationSkeleton() {
  return (
    <InventorySkeleton>
      <ValuationBodySkeleton />
    </InventorySkeleton>
  );
}

/** Nothing on hand to put a value on: where stock comes from. */
export function NothingToValue({
  branchId,
  branchName,
  canWrite,
}: {
  branchId: string;
  branchName: string;
  canWrite: boolean;
}) {
  return (
    <EmptyList
      icon={PackageOpenIcon}
      title="Nothing on hand to value"
      description={`There is no stock at ${branchName}. Once goods are received, their value is listed here.`}
    >
      {canWrite && (
        <Button asChild>
          <Link to="/stock/receive" search={{ branch: branchId }}>
            Receive goods
          </Link>
        </Button>
      )}
    </EmptyList>
  );
}
