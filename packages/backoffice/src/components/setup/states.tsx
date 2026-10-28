import { Skeleton } from "@shopper/ui/components/skeleton";

/** The wizard's shape while its progress loads: header, the step rail and one step's panel. */
export function SetupSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading setup"
    >
      <div className="flex flex-col gap-1">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-hidden lg:flex-col">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0 lg:w-full" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
