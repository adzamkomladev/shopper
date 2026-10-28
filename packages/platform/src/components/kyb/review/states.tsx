import { Skeleton } from "@shopper/ui/components/skeleton";

// The loaded sections' heights, so nothing jumps when the case arrives.
const SECTIONS = ["h-56", "h-48", "h-40", "h-32"];

export function KybReviewSkeleton() {
  return (
    <div
      className="flex max-w-3xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading verification"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-64" />
      </div>
      {SECTIONS.map((height) => (
        <Skeleton key={height} className={`${height} w-full rounded-lg`} />
      ))}
    </div>
  );
}
