import { Skeleton } from "@shopper/ui/components/skeleton";

/** Same shape as the loaded page: back link, heading, three summary cards, then the movements. */
export function StockProductSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading product stock"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
