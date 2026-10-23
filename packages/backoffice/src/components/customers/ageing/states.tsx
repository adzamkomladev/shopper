import { Skeleton } from "@shopper/ui/components/skeleton";
import { PanelSkeleton } from "../detail/panel";

/** The table's box, where the table will be. */
export function AgeingBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PanelSkeleton label="Loading ageing" />
    </div>
  );
}

/** The heading, tabs and Download CSV button, then the body: the page as it loads. */
export function AgeingSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-9 w-40" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-43.75" />
      </div>
      <AgeingBodySkeleton />
    </div>
  );
}
