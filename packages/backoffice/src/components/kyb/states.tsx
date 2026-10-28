import { Skeleton } from "@shopper/ui/components/skeleton";

/** The verification's shape while it loads: the status note and the first sections of the form. */
export function KybSkeleton() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading verification"
    >
      <Skeleton className="h-20" />
      {[3, 2].map((fields, index) => (
        <div key={index} className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
