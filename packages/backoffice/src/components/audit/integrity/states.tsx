import { Skeleton } from "@shopper/ui/components/skeleton";

/** The note and chains table of the loaded tab, so nothing moves when the data arrives. */
export function IntegritySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the audit chains"
      className="flex flex-col gap-6"
    >
      {/* The note wraps to three lines on a tablet and five on a phone. */}
      <Skeleton className="h-37 w-full md:h-27 lg:h-17" />
      <div className="flex flex-col rounded-lg border">
        <Skeleton className="h-10 rounded-b-none" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="hidden h-5 w-40 md:block" />
            <Skeleton className="hidden h-5 w-32 lg:block" />
            <Skeleton className="ml-auto h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
