import { Skeleton } from "@shopper/ui/components/skeleton";

/** The receipt page while it loads, at the loaded header and paper sizes. */
export function ReceiptSkeleton() {
  return (
    <main
      className="mx-auto max-w-xl space-y-6 px-5 pt-6 pb-16"
      aria-busy="true"
      aria-label="Loading the receipt"
    >
      <Skeleton className="-ml-2 h-10 w-33 rounded-full" />
      <Skeleton className="h-53 rounded-panel" />
      {/* The paper at its drawn width (at most three quarters of 576 dots) and a typical receipt's length. */}
      <Skeleton className="mx-auto aspect-7/10 w-full max-w-108 rounded-xl" />
    </main>
  );
}
