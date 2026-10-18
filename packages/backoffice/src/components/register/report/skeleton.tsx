import { Skeleton } from "@shopper/ui/components/skeleton";

export function ReportBodySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the report"
      className="flex flex-col gap-6"
      role="status"
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-35 rounded-2xl" key={index} />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-17 w-full max-w-xl" />
      <ReportBodySkeleton />
    </div>
  );
}
