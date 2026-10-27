import { Skeleton } from "@shopper/ui/components/skeleton";

/** The provider legend and its two choices, then the save button. */
export function PaymentSettingsSkeleton() {
  return (
    <div
      className="flex max-w-2xl flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading payment settings"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-4 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
        </div>
      ))}
      <Skeleton className="h-9 w-48" />
    </div>
  );
}
