import { ClipboardCheckIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../../admin/states";

/** Same shape as the loaded sheet: back link, heading, progress and buttons, then the lines. */
export function SheetSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading stock take"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-44" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-37.5 w-full sm:h-21 lg:h-9" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Nothing left to count: what to do next. */
export function AllCounted() {
  return (
    <EmptyList
      icon={ClipboardCheckIcon}
      title="Every product is counted"
      description="Review the variance, then post the take to bring stock on hand in line with the count."
    />
  );
}
