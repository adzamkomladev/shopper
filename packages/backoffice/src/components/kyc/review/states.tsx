import { Skeleton } from "@shopper/ui/components/skeleton";
import { BackToChecks } from "./details";

/** The review page's own blocks (back link, heading, details, decision), so nothing jumps when the check arrives. */
export function KycReviewSkeleton() {
  return (
    <div
      className="flex max-w-3xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the check"
    >
      <div className="flex flex-col gap-3">
        <BackToChecks />
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5.5 w-32 rounded-full" />
        </div>
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-52 w-full rounded-lg sm:h-44" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
