import { Skeleton } from "@shopper/ui/components/skeleton";

/** The Inventory tab's shape: the switch, the search and the empty document. */
export function InventorySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading inventory"
      className="flex flex-col gap-5"
      role="status"
    >
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-11" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
