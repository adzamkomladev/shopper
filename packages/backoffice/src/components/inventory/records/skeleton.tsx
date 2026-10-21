import { Skeleton } from "@shopper/ui/components/skeleton";

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
        <Skeleton className="h-8 w-36" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-28 lg:h-30.5" />
        <Skeleton className="h-28 lg:h-30.5" />
        <Skeleton className="h-30.5" />
        <Skeleton className="h-30.5" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
