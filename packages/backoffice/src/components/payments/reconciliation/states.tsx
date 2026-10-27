import { Skeleton } from "@shopper/ui/components/skeleton";
import { TileSkeleton } from "../../register/tile";

/** The tender table, MoMo tiles and shift table of a loaded day, so nothing moves when it arrives. */
export function ReconciliationBodySkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the reconciliation"
    >
      <Skeleton className="h-52 rounded-lg" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-5 sm:grid-cols-3">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </div>
  );
}

/** The day controls, then the body's skeleton (the page's heading and tabs stay put). */
export function ReconciliationSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-15.5 w-72 max-sm:w-full" />
      <ReconciliationBodySkeleton />
    </div>
  );
}
