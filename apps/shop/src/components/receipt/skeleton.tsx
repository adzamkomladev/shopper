import { Skeleton } from "@shopper/ui/components/skeleton";

/** The receipt page while it loads, at the loaded header and paper sizes. */
export function ReceiptSkeleton() {
  return (
    <main
      className="mx-auto max-w-xl space-y-6 px-5 pt-6 pb-16"
      aria-busy="true"
      aria-label="Loading the receipt"
    >
      <Skeleton className="h-10 w-28 rounded-full" />
      <Skeleton className="h-36 rounded-panel" />
      <Skeleton className="mx-auto h-96 w-full max-w-sm rounded-xl" />
    </main>
  );
}
