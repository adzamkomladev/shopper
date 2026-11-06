import { Skeleton } from "@shopper/ui/components/skeleton";

/** The checkout while the branch's slots load: the three cards and the total at their loaded sizes. */
export function CheckoutSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading checkout"
      className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start"
    >
      <div className="space-y-6">
        <div className="space-y-3 rounded-panel border bg-card p-5">
          <Skeleton className="h-7 w-40" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-[4.5rem] rounded-2xl" />
            <Skeleton className="h-[4.5rem] rounded-2xl" />
          </div>
        </div>
        <div className="space-y-3 rounded-panel border bg-card p-5">
          <Skeleton className="h-7 w-20" />
          <div className="flex gap-2">
            {[20, 24, 36].map((width) => (
              <Skeleton
                key={width}
                className="h-9 rounded-full"
                style={{ width: `${width * 4}px` }}
              />
            ))}
          </div>
          <Skeleton className="h-5 w-56" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, chip) => (
              <Skeleton key={chip} className="h-14 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-panel border bg-card p-5">
          <Skeleton className="h-7 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </div>
      <Skeleton className="h-80 rounded-panel" />
    </div>
  );
}
