import { Skeleton } from "@shopper/ui/components/skeleton";
import { PurchasesSkeleton } from "./skeletons";

/**
 * Same shape as the loaded page, as measured: back link, heading with its line and the actions, four
 * summary cards, the account buttons and their note, the details, then the tabs and the Purchases table.
 * It is clipped to the window, so the main area has nothing to scroll (and nothing focusable to
 * offer) while the page waits.
 */
export function CustomerSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading customer"
    >
      <div className="flex shrink-0 flex-col gap-3">
        <Skeleton className="h-7 w-36" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5.5 w-48" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-29.25" />
            <Skeleton className="h-8 w-12.75" />
            <Skeleton className="h-8 w-17" />
            <Skeleton className="h-8 w-18.75" />
          </div>
        </div>
      </div>
      <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      {/* The details wrap to one, two or three columns, so the card's height follows the window. */}
      <Skeleton className="h-79.5 shrink-0 sm:h-49.5 lg:h-34.5" />
      <div className="flex shrink-0 flex-col gap-6">
        <Skeleton className="h-8 w-77.75" />
        <PurchasesSkeleton />
      </div>
    </div>
  );
}
