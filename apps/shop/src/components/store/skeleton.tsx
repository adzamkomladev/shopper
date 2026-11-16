import { Skeleton } from "@shopper/ui/components/skeleton";

/** The store while a page loads: the bars, heading, search, chips and a grid of tiles at their loaded sizes. */
export function StoreSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the store" className="min-h-dvh">
      <div className="h-8 bg-shop-ink" />
      <div className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="ml-auto h-10 w-32 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 sm:h-10" />
          <Skeleton className="h-6 w-80 max-w-full" />
        </div>
        <Skeleton className="h-12 rounded-full" />
        <div className="flex gap-2 overflow-hidden">
          {[16, 24, 20, 28, 22].map((width) => (
            <Skeleton
              key={width}
              className="h-9 shrink-0 rounded-full"
              style={{ width: `${width * 4}px` }}
            />
          ))}
        </div>
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, tile) => (
            <div key={tile} className="flex flex-col gap-3">
              <Skeleton className="aspect-square rounded-xl" />
              <div className="space-y-1">
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
