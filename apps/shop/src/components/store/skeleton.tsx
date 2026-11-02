import { Skeleton } from "@shopper/ui/components/skeleton";

/** The store while a page loads: the bar, search, chips and a grid of tiles at their loaded sizes. */
export function StoreSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the store" className="min-h-dvh">
      <div className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="ml-auto h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-full sm:w-28" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6 pb-16 sm:px-6">
        <Skeleton className="h-14 rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          {[16, 24, 20, 28].map((width) => (
            <Skeleton
              key={width}
              className="h-10 shrink-0 rounded-full"
              style={{ width: `${width * 4}px` }}
            />
          ))}
        </div>
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, tile) => (
            <div key={tile} className="overflow-hidden rounded-2xl border bg-card">
              <Skeleton className="aspect-square rounded-none" />
              <div className="space-y-2 p-3 sm:p-4">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
