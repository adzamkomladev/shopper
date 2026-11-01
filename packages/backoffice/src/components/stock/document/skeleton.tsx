import { Skeleton } from "@shopper/ui/components/skeleton";

/** The Inventory tab's shape: the switch, the search and the empty document, with the queue beside them. */
export function InventorySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading inventory"
      className="flex flex-col gap-6 pb-6"
      role="status"
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-12 w-60" />
          <Skeleton className="h-11" />
          <Skeleton className="h-59 rounded-lg" />
        </div>
        <section className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-6 w-16" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-17 rounded-xl" />
            <Skeleton className="h-17 rounded-xl" />
          </div>
        </section>
      </div>
    </div>
  );
}
