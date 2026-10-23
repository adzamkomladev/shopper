import { Skeleton } from "@shopper/ui/components/skeleton";

/**
 * Same shape as the loaded page: back link, heading with its line and the three actions, three
 * summary cards, then the details. It is clipped to the window, so the main area has nothing to
 * scroll (and nothing focusable to offer) while the page waits.
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
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-21.75" />
            <Skeleton className="h-9 w-26" />
            <Skeleton className="h-9 w-31.25" />
          </div>
        </div>
      </div>
      <div className="grid shrink-0 gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      {/* The details wrap to one, two or three columns, so the card's height follows the window. */}
      <Skeleton className="h-79.5 shrink-0 sm:h-49.5 lg:h-34.5" />
    </div>
  );
}
