import { Skeleton } from "@shopper/ui/components/skeleton";

/** The account while it loads: the header, points card and receipt cards at their loaded sizes. */
export function AccountSkeleton() {
  return (
    <main
      className="mx-auto max-w-xl px-5 pb-16"
      aria-busy="true"
      aria-label="Loading your account"
    >
      <div className="flex items-start justify-between gap-4 pt-8 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-12 w-24 rounded-full" />
      </div>
      <Skeleton className="h-48 rounded-panel" />
      <div className="space-y-3 pt-8">
        <Skeleton className="h-7 w-40" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-20 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
