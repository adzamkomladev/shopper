import { Skeleton } from "@shopper/ui/components/skeleton";

/** The purchases table while the host reads: the same rows and columns as the loaded list. */
export function PurchaseSkeleton() {
  return (
    <div
      className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card text-sm text-muted-foreground"
      role="status"
    >
      <div className="flex min-h-64 w-full flex-col px-4">
        <span className="sr-only">Loading purchases</span>
        <div aria-hidden="true" className="grid grid-cols-3 gap-4 border-b py-4 md:grid-cols-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-4 w-20 justify-self-end" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            aria-hidden="true"
            className="grid grid-cols-3 gap-4 border-b py-4 md:grid-cols-4"
            key={index}
          >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="hidden h-5 w-24 sm:block" />
            <Skeleton className="h-5 w-20 justify-self-end" />
          </div>
        ))}
        <div aria-hidden="true" className="mt-auto flex items-center justify-between py-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </div>
  );
}
